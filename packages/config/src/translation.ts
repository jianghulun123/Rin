import type { FeedTranslationFailureReason } from "@rin/api";

/**
 * Machine-readable marker for "the upstream risk control rejected us". The server
 * stores it with the failed translation so the client can retry in the browser
 * without parsing human-readable error text.
 */
export const TRANSLATION_RISK_CONTROL_REASON: FeedTranslationFailureReason = "risk_control";

const CHUNK_MAX_LENGTH = 1800;

// Prompt names are kept in Chinese on purpose: the upstream MT model is tuned
// for Chinese instructions, matching the provider's own usage sample.
const PROMPT_LANGUAGE_NAMES: Record<string, string> = {
  ja: "日语",
  en: "英语",
  "zh-TW": "繁体中文",
  de: "德语",
  ru: "俄语",
};

export function normalizeTranslationBaseUrl(apiUrl: string): string {
  return apiUrl
    .trim()
    .replace(/\/+$/g, "")
    .replace(/\/chat\/completions$/i, "");
}

export function buildTranslationChatCompletionsUrl(apiUrl: string): string {
  const normalizedBaseUrl = normalizeTranslationBaseUrl(apiUrl);

  if (!normalizedBaseUrl) {
    throw new Error("Translation API URL not configured");
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

export function buildTranslationPrompt(text: string, language: string): string {
  const languageName = PROMPT_LANGUAGE_NAMES[language] ?? language;
  return `把这段话翻译成${languageName}：${text}`;
}

export function splitTranslationChunks(content: string): string[] {
  if (content.length <= CHUNK_MAX_LENGTH) {
    return content.trim() ? [content] : [];
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of content.split("\n")) {
    if (current && current.length + line.length + 1 > CHUNK_MAX_LENGTH) {
      chunks.push(current);
      current = "";
    }

    if (line.length > CHUNK_MAX_LENGTH) {
      for (let offset = 0; offset < line.length; offset += CHUNK_MAX_LENGTH) {
        chunks.push(line.slice(offset, offset + CHUNK_MAX_LENGTH));
      }
      continue;
    }

    current = current ? `${current}\n${line}` : line;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function stripReasoningTags(text: string): string {
  if (!text) return "";

  let out = text;
  out = out.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think\s*>/gi, "");
  out = out.replace(/<think(?:\s[^>]*)?>[\s\S]*$/gi, "");
  out = out.replace(/<thinking(?:\s[^>]*)?>[\s\S]*?<\/thinking\s*>/gi, "");
  out = out.replace(/<thinking(?:\s[^>]*)?>[\s\S]*$/gi, "");
  out = out.replace(/<reasoning(?:\s[^>]*)?>[\s\S]*?<\/reasoning\s*>/gi, "");
  out = out.replace(/<reasoning(?:\s[^>]*)?>[\s\S]*$/gi, "");

  return out.trim();
}

/** Reads an OpenAI-compatible chat completion body down to the translated text. */
export function extractTranslationContent(payload: unknown): string {
  const choices = (payload as { choices?: Array<{ message?: { content?: string } }> } | null)
    ?.choices;
  const translated = stripReasoningTags(choices?.[0]?.message?.content ?? "");

  if (!translated) {
    throw new Error("Empty response from translation API");
  }

  return translated;
}
