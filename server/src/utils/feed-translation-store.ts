import type { FeedTranslation, FeedTranslationStatus } from "@rin/api";

export function parseTranslations(raw: unknown): Record<string, FeedTranslation> {
    if (typeof raw !== "string" || !raw.trim()) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        const result: Record<string, FeedTranslation> = {};
        for (const [language, value] of Object.entries(parsed as Record<string, any>)) {
            if (!value || typeof value !== "object") {
                continue;
            }

            result[language] = {
                language,
                status: normalizeStatus(value.status),
                title: typeof value.title === "string" ? value.title : "",
                content: typeof value.content === "string" ? value.content : "",
                error: typeof value.error === "string" ? value.error : "",
            };

            if (value.failure_reason === "risk_control") {
                result[language].failure_reason = "risk_control";
            }
        }

        return result;
    } catch {
        return {};
    }
}

export function serializeTranslations(translations: Record<string, FeedTranslation>): string {
    return JSON.stringify(translations);
}

function normalizeStatus(value: unknown): FeedTranslationStatus {
    switch (value) {
        case "pending":
        case "processing":
        case "completed":
        case "failed":
            return value;
        default:
            return "idle";
    }
}

export function updateTranslationEntry(
    raw: unknown,
    language: string,
    updates: Partial<FeedTranslation>,
): string {
    const translations = parseTranslations(raw);
    const current = translations[language];
    const status = updates.status ?? current?.status ?? "idle";
    // A failure reason only ever describes a failed entry, and it must be set explicitly
    // by the caller: inheriting it would let a stale risk-control marker outlive the
    // failure (e.g. a later queue error on the same language).
    const failureReason = status === "failed" ? updates.failure_reason : undefined;

    translations[language] = {
        language,
        status,
        title: updates.title ?? current?.title ?? "",
        content: updates.content ?? current?.content ?? "",
        error: updates.error ?? current?.error ?? "",
    };

    if (failureReason) {
        translations[language].failure_reason = failureReason;
    }

    return serializeTranslations(translations);
}

/** Drops every stored translation, used when the source article changes. */
export function resetTranslations(): string {
    return serializeTranslations({});
}
