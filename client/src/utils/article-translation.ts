import { TRANSLATION_LANGUAGES } from "@rin/config";

export type ArticleTranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

export const ARTICLE_TRANSLATION_LANGUAGES = TRANSLATION_LANGUAGES;

export const ARTICLE_TRANSLATION_LANGUAGE_LABELS: Record<string, string> = {
  ja: "日本語",
  en: "English",
  "zh-TW": "繁體中文",
  de: "Deutsch",
  ru: "Русский",
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().split("-")[0];
}

/**
 * Maps the active UI language onto a supported article translation language.
 * Falls back to the primary subtag so `zh-Hans`/`en-US`/`ja-JP` all resolve.
 */
export function resolveArticleTranslationLanguage(
  uiLanguage: string | undefined,
): ArticleTranslationLanguage | null {
  if (!uiLanguage) {
    return null;
  }

  const lower = uiLanguage.trim().toLowerCase();
  if (lower.startsWith("zh-tw") || lower.startsWith("zh-hant")) {
    return "zh-TW";
  }

  const base = normalizeTag(uiLanguage);
  const matched = ARTICLE_TRANSLATION_LANGUAGES.find(
    (language) => language.toLowerCase() === base,
  );

  return matched ?? null;
}
