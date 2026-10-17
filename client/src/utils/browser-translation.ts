import {
  buildTranslationChatCompletionsUrl,
  buildTranslationPrompt,
  extractTranslationContent,
  splitTranslationChunks,
} from "@rin/config";

export type BrowserTranslationConfig = {
  apiUrl: string;
  model: string;
};

/**
 * Translates text directly from the visitor's browser. The server cannot call the
 * public endpoint (its HTTP/2 fingerprint is answered with 412), while a real
 * browser passes, so this is the fallback path when the stored translation failed
 * to upstream risk control.
 */
export async function translateTextInBrowser(
  config: BrowserTranslationConfig,
  text: string,
  language: string,
): Promise<string> {
  const chunks = splitTranslationChunks(text);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    translatedChunks.push(await requestBrowserTranslation(config, buildTranslationPrompt(chunk, language)));
  }

  return translatedChunks.join("\n");
}

async function requestBrowserTranslation(
  config: BrowserTranslationConfig,
  prompt: string,
): Promise<string> {
  const response = await fetch(buildTranslationChatCompletionsUrl(config.apiUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  if (!response.ok) {
    throw new Error(`Translation API error ${response.status}`);
  }

  return extractTranslationContent(await response.json());
}
