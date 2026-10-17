export const FEED_AI_SUMMARY_TASK = "feed.ai-summary.generate" as const;
export const FEED_TRANSLATION_TASK = "feed.translation.generate" as const;

export type FeedAISummaryStatus =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface FeedAISummaryTaskPayload {
  feedId: number;
  expectedUpdatedAt?: string;
  expectedUpdatedAtUnix?: number;
}

export interface FeedAISummaryTask {
  type: typeof FEED_AI_SUMMARY_TASK;
  payload: FeedAISummaryTaskPayload;
}

export interface FeedTranslationTaskPayload {
  feedId: number;
  language: string;
  expectedUpdatedAt?: string;
  expectedUpdatedAtUnix?: number;
}

export interface FeedTranslationTask {
  type: typeof FEED_TRANSLATION_TASK;
  payload: FeedTranslationTaskPayload;
}

export type QueueTask = FeedAISummaryTask | FeedTranslationTask;

export function createFeedAISummaryTask(
  payload: FeedAISummaryTaskPayload,
): FeedAISummaryTask {
  return {
    type: FEED_AI_SUMMARY_TASK,
    payload,
  };
}

export function createFeedTranslationTask(
  payload: FeedTranslationTaskPayload,
): FeedTranslationTask {
  return {
    type: FEED_TRANSLATION_TASK,
    payload,
  };
}

function hasExpectedUpdatedAt(payload: {
  expectedUpdatedAt?: string;
  expectedUpdatedAtUnix?: number;
}): boolean {
  return (
    typeof payload?.expectedUpdatedAtUnix === "number" ||
    typeof payload?.expectedUpdatedAt === "string"
  );
}

export function isQueueTask(value: unknown): value is QueueTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Partial<QueueTask>;

  if (task.type === FEED_AI_SUMMARY_TASK) {
    const payload = task.payload as Partial<FeedAISummaryTaskPayload> | undefined;
    return Boolean(payload) && typeof payload?.feedId === "number" && hasExpectedUpdatedAt(payload!);
  }

  if (task.type === FEED_TRANSLATION_TASK) {
    const payload = task.payload as Partial<FeedTranslationTaskPayload> | undefined;
    return (
      Boolean(payload) &&
      typeof payload?.feedId === "number" &&
      typeof payload?.language === "string" &&
      hasExpectedUpdatedAt(payload!)
    );
  }

  return false;
}
