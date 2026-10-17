import { describe, expect, it } from "bun:test";
import {
    buildTranslationSystemPrompt,
    splitTranslationChunks,
    stripReasoningTags,
} from "../translation";

describe("buildTranslationSystemPrompt", () => {
    it("names the target language in Chinese", () => {
        const prompt = buildTranslationSystemPrompt("en");
        expect(prompt).toContain("英语");
        expect(prompt).toContain("只输出译文");
    });

    it("falls back to the raw code for unmapped languages", () => {
        expect(buildTranslationSystemPrompt("ko")).toContain("ko");
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
