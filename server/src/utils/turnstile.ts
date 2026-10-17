const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const WIDGET_ACTION = "login";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_TOKEN_LENGTH = 2048;

type TurnstileEnv = {
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET?: string;
    TURNSTILE_HOSTNAMES?: string;
};

export type TurnstileConfig = {
    siteKey: string;
    secret: string;
    hostnames: string[];
};

export type TurnstileVerification =
    | { ok: true }
    | { ok: false; reason: "invalid_token" | "rejected" | "unavailable" };

function readValue(value?: string): string {
    return typeof value === "string" ? value.trim() : "";
}

function readHostnames(value?: string): string[] {
    return readValue(value)
        .split(",")
        .map((hostname) => hostname.trim())
        .filter(Boolean);
}

export function getTurnstileConfig(env: TurnstileEnv): TurnstileConfig | null {
    const siteKey = readValue(env.TURNSTILE_SITE_KEY);
    const secret = readValue(env.TURNSTILE_SECRET);

    if (!siteKey || !secret) {
        return null;
    }

    return { siteKey, secret, hostnames: readHostnames(env.TURNSTILE_HOSTNAMES) };
}

export async function verifyTurnstileToken(
    config: TurnstileConfig,
    { token, remoteIp }: { token?: string; remoteIp?: string },
): Promise<TurnstileVerification> {
    const trimmedToken = readValue(token);

    if (!trimmedToken || trimmedToken.length > MAX_TOKEN_LENGTH) {
        return { ok: false, reason: "invalid_token" };
    }

    const payload = new URLSearchParams({ secret: config.secret, response: trimmedToken });
    if (remoteIp) {
        payload.set("remoteip", remoteIp);
    }

    try {
        const response = await fetch(SITEVERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: payload,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
            return { ok: false, reason: "unavailable" };
        }

        const result = await response.json() as { success?: boolean; action?: string; hostname?: string };

        if (!result.success || result.action !== WIDGET_ACTION) {
            return { ok: false, reason: "rejected" };
        }

        if (config.hostnames.length > 0 && !config.hostnames.includes(result.hostname ?? "")) {
            return { ok: false, reason: "rejected" };
        }

        return { ok: true };
    } catch {
        return { ok: false, reason: "unavailable" };
    }
}
