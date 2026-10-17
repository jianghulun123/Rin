import { describe, expect, it } from "bun:test";
import { parseTranslations, updateTranslationEntry } from "../feed-translation-store";

describe("parseTranslations", () => {
    it("keeps a stored risk control reason", () => {
        const raw = JSON.stringify({
            en: { status: "failed", error: "412", failure_reason: "risk_control" },
        });

        expect(parseTranslations(raw).en.failure_reason).toBe("risk_control");
    });

    it("drops unknown failure reasons", () => {
        const raw = JSON.stringify({
            en: { status: "failed", error: "boom", failure_reason: "something_else" },
        });

        expect(parseTranslations(raw).en.failure_reason).toBeUndefined();
    });
});

describe("updateTranslationEntry", () => {
    it("stores the reason together with a failure", () => {
        const raw = updateTranslationEntry("{}", "en", {
            status: "failed",
            error: "412",
            failure_reason: "risk_control",
        });

        expect(parseTranslations(raw).en.failure_reason).toBe("risk_control");
    });

    it("clears the reason once the entry is no longer failed", () => {
        const failed = updateTranslationEntry("{}", "en", {
            status: "failed",
            error: "412",
            failure_reason: "risk_control",
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

    it("does not resurrect a stale reason on a later failure without one", () => {
        const failed = updateTranslationEntry("{}", "en", {
            status: "failed",
            error: "412",
            failure_reason: "risk_control",
        });

        const queueFailure = updateTranslationEntry(failed, "en", {
            status: "failed",
            error: "queue unavailable",
        });

        expect(parseTranslations(queueFailure).en.failure_reason).toBeUndefined();
    });

    it("leaves other languages untouched", () => {
        const raw = updateTranslationEntry(
            updateTranslationEntry("{}", "en", { status: "completed", content: "A" }),
            "ja",
            { status: "failed", error: "412", failure_reason: "risk_control" },
        );

        const parsed = parseTranslations(raw);
        expect(parsed.en.status).toBe("completed");
        expect(parsed.ja.failure_reason).toBe("risk_control");
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
