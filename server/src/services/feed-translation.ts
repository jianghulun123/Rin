import { eq } from "drizzle-orm";
import type { FeedTranslation } from "@rin/api";
import type { CacheImpl, DB } from "../core/hono-types";
import { feeds } from "../db/schema";
import { createFeedTranslationTask, createTaskQueue } from "../queue";
import { getTranslationConfig } from "../utils/db-config";
import { parseTranslations, updateTranslationEntry } from "../utils/feed-translation-store";
import { generateFeedTranslation, normalizeTranslationLanguage } from "../utils/translate";
import { matchesExpectedUpdatedAt, normalizeQueueUpdatedAt } from "./feed-ai-summary";
import { clearFeedDetailCache } from "./clear-feed-cache";

type ConfigReader = {
  get(key: string): Promise<unknown>;
};

export type FeedTranslationView = Pick<FeedTranslation, "language" | "status" | "error">;

/** Strips translated bodies so list payloads only carry per-language status. */
export function toTranslationViews(raw: unknown): FeedTranslationView[] {
  return Object.values(parseTranslations(raw)).map(({ language, status, error }) => ({
    language,
    status,
    error,
  }));
}

export async function enqueueFeedTranslation(
  env: Env,
  feedId: number,
  language: string,
  updatedAt: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await createTaskQueue(env).send(
      createFeedTranslationTask({
        feedId,
        language,
        expectedUpdatedAtUnix: normalizeQueueUpdatedAt(updatedAt),
      }),
    );

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

type EnsureResult =
  | { ok: true; translation: FeedTranslation }
  | { ok: false; error: string };

/**
 * Returns the stored translation for a language, queueing generation when it is
 * missing or previously failed. Pending/processing entries are returned as-is so
 * polling clients do not pile up duplicate tasks.
 */
export async function ensureFeedTranslation(
  db: DB,
  cache: CacheImpl,
  serverConfig: ConfigReader,
  env: Env,
  feedId: number,
  language: string,
): Promise<EnsureResult> {
  const normalizedLanguage = normalizeTranslationLanguage(language);
  if (!normalizedLanguage) {
    return { ok: false, error: "Unsupported language" };
  }

  const translationConfig = await getTranslationConfig(serverConfig);
  if (!translationConfig.enabled) {
    return { ok: false, error: "Translation is not enabled" };
  }

  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: { id: true, alias: true, updatedAt: true, draft: true, translations: true },
  });

  if (!feed) {
    return { ok: false, error: "Feed not found" };
  }

  if (feed.draft === 1) {
    return { ok: false, error: "Translation is not available for drafts" };
  }

  const existing = parseTranslations(feed.translations)[normalizedLanguage];
  if (existing?.status === "completed" && existing.content.trim()) {
    return { ok: true, translation: existing };
  }

  if (existing?.status === "pending" || existing?.status === "processing") {
    return { ok: true, translation: existing };
  }

  // Mark pending before queueing so a fast worker cannot be overwritten by this write.
  await db
    .update(feeds)
    .set({
      translations: updateTranslationEntry(feed.translations, normalizedLanguage, {
        status: "pending",
        title: "",
        content: "",
        error: "",
      }),
    })
    .where(eq(feeds.id, feed.id));
  await clearFeedDetailCache(cache, feed.id, feed.alias);

  const queued = await enqueueFeedTranslation(env, feedId, normalizedLanguage, feed.updatedAt);

  if (!queued.ok) {
    await db
      .update(feeds)
      .set({
        translations: updateTranslationEntry(feed.translations, normalizedLanguage, {
          status: "failed",
          error: queued.error,
        }),
      })
      .where(eq(feeds.id, feed.id));
    await clearFeedDetailCache(cache, feed.id, feed.alias);

    return { ok: false, error: queued.error };
  }

  return {
    ok: true,
    translation: { language: normalizedLanguage, status: "pending", title: "", content: "", error: "" },
  };
}

export async function processFeedTranslationTask(
  env: Env,
  db: DB,
  cache: CacheImpl,
  serverConfig: ConfigReader,
  payload: {
    feedId: number;
    language: string;
    expectedUpdatedAt?: string;
    expectedUpdatedAtUnix?: number;
  },
) {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, payload.feedId),
  });

  if (!feed) {
    return;
  }

  if (!matchesExpectedUpdatedAt(feed.updatedAt, payload)) {
    // Content changed after this task was queued: reset so the next request re-queues
    // against the current revision instead of leaving the entry stuck in pending.
    await db
      .update(feeds)
      .set({
        translations: updateTranslationEntry(feed.translations, payload.language, { status: "idle" }),
      })
      .where(eq(feeds.id, feed.id));
    await clearFeedDetailCache(cache, feed.id, feed.alias);
    return;
  }

  const translationConfig = await getTranslationConfig(serverConfig);
  if (!translationConfig.enabled || feed.draft === 1) {
    await db
      .update(feeds)
      .set({
        translations: updateTranslationEntry(feed.translations, payload.language, { status: "idle" }),
      })
      .where(eq(feeds.id, feed.id));
    await clearFeedDetailCache(cache, feed.id, feed.alias);
    return;
  }

  await db
    .update(feeds)
    .set({
      translations: updateTranslationEntry(feed.translations, payload.language, { status: "processing" }),
    })
    .where(eq(feeds.id, feed.id));
  const result = await generateFeedTranslation(
    env,
    serverConfig,
    { title: feed.title, content: feed.content },
    payload.language,
  );

  // Re-read so a language queued while this task ran is not clobbered.
  const latest = await db.query.feeds.findFirst({
    where: eq(feeds.id, feed.id),
    columns: { translations: true },
  });

  await db
    .update(feeds)
    .set({
      translations: updateTranslationEntry(
        latest?.translations ?? feed.translations,
        payload.language,
        result.ok
          ? { status: "completed", title: result.title, content: result.content, error: "" }
          : { status: "failed", error: result.error },
      ),
    })
    .where(eq(feeds.id, feed.id));

  await clearFeedDetailCache(cache, feed.id, feed.alias);
}
