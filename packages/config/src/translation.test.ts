import { describe, expect, it } from "bun:test";
import {
    buildTranslationChatCompletionsUrl,
    buildTranslationPrompt,
    extractTranslationContent,
    normalizeTranslationBaseUrl,
    splitTranslationChunks,
    stripReasoningTags,
} from "../translation";

describe("normalizeTranslationBaseUrl", () => {
    it("removes trailing slashes and the chat completions suffix", () => {
        expect(normalizeTranslationBaseUrl("https://example.com/v1/")).toBe("https://example.com/v1");
        expect(normalizeTranslationBaseUrl("https://example.com/v1/chat/completions")).toBe("https://example.com/v1");
    });
});

describe("buildTranslationChatCompletionsUrl", () => {
    it("builds the endpoint from a base URL", () => {
        expect(buildTranslationChatCompletionsUrl("https://example.com/v1")).toBe(
            "https://example.com/v1/chat/completions",
        );
    });

    it("throws when no URL is configured", () => {
        expect(() => buildTranslationChatCompletionsUrl("   ")).toThrow("Translation API URL not configured");
    });
});

describe("buildTranslationPrompt", () => {
    it("names the target language in Chinese", () => {
        expect(buildTranslationPrompt("hello", "en")).toBe("把这段话翻译成英语：hello");
    });

    it("falls back to the raw code for unmapped languages", () => {
        expect(buildTranslationPrompt("hello", "ko")).toBe("把这段话翻译成ko：hello");
    });
});

describe("splitTranslationChunks", () => {
    it("returns an empty list for blank content", () => {
        expect(splitTranslationChunks("   ")).toEqual([]);
    });

    it("keeps short content in a single chunk", () => {
        expect(splitTranslationChunks("short text")).toEqual(["short text"]);
    });

    it("splits oversized single lines at the chunk boundary", () => {
        const chunks = splitTranslationChunks("a".repeat(4000));
        expect(chunks).toHaveLength(3);
        expect(chunks.every((chunk) => chunk.length <= 1800)).toBe(true);
    });

    it("splits on newlines without losing content", () => {
        const line = "x".repeat(1000);
        const chunks = splitTranslationChunks(`${line}\n${line}\n${line}`);
        expect(chunks).toHaveLength(3);
        expect(chunks.join("\n").replace(/\n/g, "")).toBe(line.repeat(3));
    });
});

describe("stripReasoningTags", () => {
    it("removes closed and unclosed reasoning blocks", () => {
        expect(stripReasoningTags("<think>secret</think>answer")).toBe("answer");
        expect(stripReasoningTags("answer<thinking>dangling")).toBe("answer");
        expect(stripReasoningTags("")).toBe("");
    });
});

describe("extractTranslationContent", () => {
    it("reads the first choice content", () => {
        expect(
            extractTranslationContent({ choices: [{ message: { content: "译文" } }] }),
        ).toBe("译文");
    });

    it("strips reasoning tags around the answer", () => {
        expect(
            extractTranslationContent({ choices: [{ message: { content: "<think>x</think>译文" } }] }),
        ).toBe("译文");
    });

    it("throws on an empty completion", () => {
        expect(() => extractTranslationContent({ choices: [] })).toThrow("Empty response from translation API");
    });
});
