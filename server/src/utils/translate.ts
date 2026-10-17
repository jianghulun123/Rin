import type { AIChatMessage } from "./ai";
import { runAIChat } from "./ai";
import type { TranslationConfig } from "@rin/api";
import {
    TRANSLATION_LANGUAGES,
    buildTranslationSystemPrompt,
    splitTranslationChunks,
    stripReasoningTags,
} from "@rin/config";
import { getTranslationConfig } from "./db-config";

type ConfigReader = {
    get(key: string): Promise<unknown>;
};

export function normalizeTranslationLanguage(language: string | undefined | null): string | null {
    if (!language) {
        return null;
    }

    const trimmed = language.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.toLowerCase() === "zh-tw" || trimmed.toLowerCase() === "zh-hant") {
        return "zh-TW";
    }

    const matched = (TRANSLATION_LANGUAGES as readonly string[]).find(
        (candidate) => candidate.toLowerCase() === trimmed.toLowerCase(),
    );

    return matched ?? null;
}

async function requestTranslation(
    env: Env,
    config: TranslationConfig,
    text: string,
    language: string,
): Promise<string> {
    const messages: AIChatMessage[] = [
        { role: "system", content: buildTranslationSystemPrompt(language) },
        { role: "user", content: text },
    ];
    const result = await runAIChat(
        env,
        {
            provider: config.provider,
            model: config.model,
            api_key: config.api_key,
            api_url: config.api_url,
        },
        messages,
        { maxTokens: 4000, temperature: 0.2 },
    );

    const translated = stripReasoningTags(result ?? "");
    if (!translated) {
        throw new Error("Empty response from translation model");
    }

    return translated;
}

export async function translateText(
    env: Env,
    config: TranslationConfig,
    text: string,
    language: string,
): Promise<string> {
    const chunks = splitTranslationChunks(text);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
        translatedChunks.push(await requestTranslation(env, config, chunk, language));
    }

    return translatedChunks.join("\n");
}

export async function generateFeedTranslation(
    env: Env,
    serverConfig: ConfigReader,
    feed: { title: string | null; content: string },
    language: string,
): Promise<{ ok: true; title: string; content: string } | { ok: false; error: string }> {
    const config = await getTranslationConfig(serverConfig);

    if (!config.enabled) {
        return { ok: false, error: "Translation is not enabled" };
    }

    try {
        const title = feed.title?.trim() ? await translateText(env, config, feed.title, language) : "";
        const content = await translateText(env, config, feed.content, language);
        return { ok: true, title, content };
    } catch (error) {
        console.error("[Translation] Failed to translate feed:", error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function testTranslationModel(
    env: Env,
    serverConfig: ConfigReader,
    overrides: Partial<TranslationConfig>,
    testPrompt: string,
    language: string,
): Promise<{ success: boolean; response?: string; error?: string; details?: string }> {
    const stored = await getTranslationConfig(serverConfig);
    const config: TranslationConfig = { ...stored, ...overrides, enabled: true };

    try {
        const translated = await translateText(env, config, testPrompt, language);
        return { success: true, response: translated };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Translation] Test failed:", error);

        if (/fetch failed|NetworkError/i.test(message)) {
            return {
                success: false,
                error: "Network error: Unable to connect to the AI provider",
                details: "Please check the API URL and network connection.",
            };
        }

        if (/Workers AI binding is not configured/i.test(message)) {
            return {
                success: false,
                error: "Workers AI is not configured",
                details: "Add the Cloudflare Workers AI binding before using the worker-ai provider.",
            };
        }

        if (/401|403|Unauthorized|Authentication/i.test(message)) {
            return { success: false, error: "Authentication failed: Invalid API key" };
        }

        if (/429/.test(message)) {
            return { success: false, error: "Rate limit exceeded", details: "Too many requests. Please wait a moment." };
        }

        if (/404/.test(message)) {
            return {
                success: false,
                error: "Model not found",
                details: `Model "${config.model}" is not available for provider "${config.provider}".`,
            };
        }

        return { success: false, error: message };
    }
}
