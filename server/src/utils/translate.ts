import type { FeedTranslationFailureReason, TranslationConfig } from "@rin/api";
import {
    TRANSLATION_LANGUAGES,
    buildTranslationChatCompletionsUrl,
    buildTranslationPrompt,
    extractTranslationContent,
    splitTranslationChunks,
} from "@rin/config";
import { getTranslationConfig } from "./db-config";

type ConfigReader = {
    get(key: string): Promise<unknown>;
};

// The public Index-Translate API is keyless and identifies callers by this exact
// client name; a spoofed browser UA is treated as scraping and answered with 412.
const TRANSLATION_USER_AGENT = "Index-Translate-Client/1.0";

export { buildTranslationChatCompletionsUrl, buildTranslationPrompt, splitTranslationChunks };

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

const ERROR_BODY_MAX_LENGTH = 300;

type TranslationFailure = Error & { failureReason?: FeedTranslationFailureReason };

function translationFailure(message: string, failureReason?: FeedTranslationFailureReason): TranslationFailure {
    const error: TranslationFailure = new Error(message);
    if (failureReason) {
        error.failureReason = failureReason;
    }
    return error;
}

/** Reads the actionable cause off a thrown translation error, if there is one. */
export function getTranslationFailureReason(error: unknown): FeedTranslationFailureReason | undefined {
    return (error as TranslationFailure | undefined)?.failureReason;
}

/**
 * Turns an upstream error body into one short line. bilibili risk control answers
 * 4xx with a full HTML captcha page; storing that verbatim buries the real cause
 * in the settings panel and in the per-language failure state.
 */
async function describeErrorResponse(response: Response): Promise<string> {
    const body = (await response.text()).trim();

    if (!body) {
        return response.statusText || "Empty error response";
    }

    if (/<html|<!doctype|<\/body>/i.test(body)) {
        if (response.status === 412 || /security control policy|安全风控/.test(body)) {
            return "Upstream risk control rejected the request (HTTP 412). The public Index-Translate endpoint blocks server-side traffic; the browser retries it when possible.";
        }

        return `Upstream returned an HTML error page (${response.status}) instead of JSON. Check that the API URL points to an OpenAI-compatible /v1 endpoint.`;
    }

    return body.length > ERROR_BODY_MAX_LENGTH ? `${body.slice(0, ERROR_BODY_MAX_LENGTH)}…` : body;
}

function isRiskControlRejection(response: Response, description: string): boolean {
    return response.status === 412 || /risk control rejected/i.test(description);
}

async function requestTranslation(
    config: TranslationConfig,
    prompt: string,
): Promise<string> {
    // The public endpoint needs no credentials, and sending a placeholder token
    // makes the request look forged to the upstream risk control.
    const apiKey = config.api_key.trim();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": TRANSLATION_USER_AGENT,
    };

    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(buildTranslationChatCompletionsUrl(config.api_url), {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: prompt }],
            chat_template_kwargs: { enable_thinking: false },
        }),
    });

    if (!response.ok) {
        const description = await describeErrorResponse(response);
        throw translationFailure(
            `Translation API error ${response.status}: ${description}`,
            isRiskControlRejection(response, description) ? "risk_control" : undefined,
        );
    }

    return extractTranslationContent(await response.json());
}

export async function translateText(
    config: TranslationConfig,
    text: string,
    language: string,
): Promise<string> {
    const chunks = splitTranslationChunks(text);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
        translatedChunks.push(await requestTranslation(config, buildTranslationPrompt(chunk, language)));
    }

    return translatedChunks.join("\n");
}

export async function generateFeedTranslation(
    serverConfig: ConfigReader,
    feed: { title: string | null; content: string },
    language: string,
): Promise<
    | { ok: true; title: string; content: string }
    | { ok: false; error: string; failureReason?: FeedTranslationFailureReason }
> {
    const config = await getTranslationConfig(serverConfig);

    if (!config.enabled) {
        return { ok: false, error: "Translation is not enabled" };
    }

    try {
        const title = feed.title?.trim() ? await translateText(config, feed.title, language) : "";
        const content = await translateText(config, feed.content, language);
        return { ok: true, title, content };
    } catch (error) {
        console.error("[Translation] Failed to translate feed:", error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            failureReason: getTranslationFailureReason(error),
        };
    }
}

export async function testTranslationModel(
    serverConfig: ConfigReader,
    overrides: Partial<TranslationConfig>,
    testPrompt: string,
    language: string,
): Promise<{ success: boolean; response?: string; error?: string; details?: string }> {
    const stored = await getTranslationConfig(serverConfig);
    const config: TranslationConfig = { ...stored, ...overrides, enabled: true };

    try {
        const translated = await translateText(config, testPrompt, language);
        return { success: true, response: translated };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Translation] Test failed:", error);

        if (/fetch failed|NetworkError/i.test(message)) {
            return {
                success: false,
                error: "Network error: Unable to connect to translation API",
                details: "Please check the API URL and network connection.",
            };
        }

        if (/401|403|Unauthorized/i.test(message)) {
            return { success: false, error: "Authentication failed: Invalid API key" };
        }

        if (/429/.test(message)) {
            return { success: false, error: "Rate limit exceeded", details: "Too many requests. Please wait a moment." };
        }

        if (/404/.test(message)) {
            return {
                success: false,
                error: "Model not found",
                details: `Model "${config.model}" is not available at ${config.api_url}.`,
            };
        }

        return { success: false, error: message };
    }
}
