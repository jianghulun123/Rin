import { describe, expect, it } from "bun:test";
import { parseTranslations, updateTranslationEntry } from "../feed-translation-store";

describe("parseTranslations", () => {
    it("keeps stored entries and drops unknown fields", () => {
        const raw = JSON.stringify({
            en: { status: "failed", error: "boom", failure_reason: "anything" },
        });

        expect(parseTranslations(raw).en).toEqual({
            language: "en",
            status: "failed",
            title: "",
            content: "",
            error: "boom",
        });
    });
});

describe("updateTranslationEntry", () => {
    it("stores a failed entry with its error", () => {
        const raw = updateTranslationEntry("{}", "en", {
            status: "failed",
            error: "boom",
        });

        const entry = parseTranslations(raw).en;
        expect(entry.status).toBe("failed");
        expect(entry.error).toBe("boom");
    });

    it("clears the error once the entry completes", () => {
        const failed = updateTranslationEntry("{}", "en", {
            status: "failed",
            error: "boom",
        });

        const completed = updateTranslationEntry(failed, "en", {
            status: "completed",
            content: "译文",
            error: "",
        });

        expect(parseTranslations(completed).en).toEqual({
            language: "en",
            status: "completed",
            title: "",
            content: "译文",
            error: "",
        });
    });

    it("leaves other languages untouched", () => {
        const raw = updateTranslationEntry(
            updateTranslationEntry("{}", "en", { status: "completed", content: "A" }),
            "ja",
            { status: "failed", error: "boom" },
        );

        const parsed = parseTranslations(raw);
        expect(parsed.en.status).toBe("completed");
        expect(parsed.ja.status).toBe("failed");
    });

    it("stores a translated title alongside the body", () => {
        const raw = updateTranslationEntry("{}", "en", {
            status: "completed",
            title: "Translated title",
            content: "Translated body",
            error: "",
        });

        const entry = parseTranslations(raw).en;
        expect(entry.title).toBe("Translated title");
        expect(entry.content).toBe("Translated body");
    });

    it("drops the old translated title when re-queued, so a stale one cannot outlive the edit", () => {
        const completed = updateTranslationEntry("{}", "en", {
            status: "completed",
            title: "Old title",
            content: "Old body",
            error: "",
        });

        const requeued = updateTranslationEntry(completed, "en", {
            status: "pending",
            title: "",
            content: "",
            error: "",
        });

        expect(parseTranslations(requeued).en.title).toBe("");
    });
});
