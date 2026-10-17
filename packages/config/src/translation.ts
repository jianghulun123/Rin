const CHUNK_MAX_LENGTH = 1800;

// Prompt names are kept in Chinese on purpose: the instructions are written in
// Chinese, and the translation models are asked to answer in the target language.
const PROMPT_LANGUAGE_NAMES: Record<string, string> = {
  ja: "日语",
  en: "英语",
  "zh-TW": "繁体中文",
  de: "德语",
  ru: "俄语",
};

export function translationLanguageName(language: string): string {
  return PROMPT_LANGUAGE_NAMES[language] ?? language;
}

/**
 * Instruction sent as the system message. Every provider receives the same text,
 * so the model is told to answer with the translation alone.
 */
export function buildTranslationSystemPrompt(language: string): string {
  return `你是专业翻译引擎。把用户提供的文本翻译成${translationLanguageName(language)}，只输出译文，不要解释、不要加引号或注释，并保留原文的 Markdown 结构。`;
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
