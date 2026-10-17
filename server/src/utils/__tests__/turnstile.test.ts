import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { getTurnstileConfig, verifyTurnstileToken } from "../turnstile";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

describe("getTurnstileConfig", () => {
  it("stays disabled when the site key or secret is missing", () => {
    expect(getTurnstileConfig({ TURNSTILE_SITE_KEY: "site-key" })).toBeNull();
    expect(getTurnstileConfig({ TURNSTILE_SECRET: "secret" })).toBeNull();
    expect(getTurnstileConfig({ TURNSTILE_SITE_KEY: "  ", TURNSTILE_SECRET: " " })).toBeNull();
    expect(getTurnstileConfig({})).toBeNull();
  });

  it("trims values and parses the hostname allowlist", () => {
    const config = getTurnstileConfig({
      TURNSTILE_SITE_KEY: " site-key ",
      TURNSTILE_SECRET: " secret ",
      TURNSTILE_HOSTNAMES: "blog.example.com, localhost ,, 127.0.0.1",
    });

    expect(config).toEqual({
      siteKey: "site-key",
      secret: "secret",
      hostnames: ["blog.example.com", "localhost", "127.0.0.1"],
    });
  });

  it("keeps the allowlist empty when no hostnames are configured", () => {
    const config = getTurnstileConfig({ TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET: "secret" });

    expect(config?.hostnames).toEqual([]);
  });
});

describe("verifyTurnstileToken", () => {
  const config = { siteKey: "site-key", secret: "secret", hostnames: ["blog.example.com"] };
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    fetchMock = mock(async () => new Response(JSON.stringify({ success: true, action: "login", hostname: "blog.example.com" })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function respondWith(payload: unknown, ok = true) {
    fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: ok ? 200 : 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  }

  it("accepts a verified token from an allowed hostname", async () => {
    const result = await verifyTurnstileToken(config, { token: "token-value" });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("response=token-value");
    expect(String(init.body)).toContain("secret=secret");
  });

  it("forwards the client IP when available", async () => {
    await verifyTurnstileToken(config, { token: "token-value", remoteIp: "203.0.113.7" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("remoteip=203.0.113.7");
  });

  it("rejects a missing token without calling siteverify", async () => {
    await expect(verifyTurnstileToken(config, {})).resolves.toEqual({ ok: false, reason: "invalid_token" });
    await expect(verifyTurnstileToken(config, { token: "   " })).resolves.toEqual({ ok: false, reason: "invalid_token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized token without calling siteverify", async () => {
    const result = await verifyTurnstileToken(config, { token: "x".repeat(2049) });

    expect(result).toEqual({ ok: false, reason: "invalid_token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a failed verification", async () => {
    respondWith({ success: false, "error-codes": ["invalid-input-response"] });

    expect(await verifyTurnstileToken(config, { token: "token-value" })).toEqual({ ok: false, reason: "rejected" });
  });

  it("rejects a token issued for another action", async () => {
    respondWith({ success: true, action: "signup", hostname: "blog.example.com" });

    expect(await verifyTurnstileToken(config, { token: "token-value" })).toEqual({ ok: false, reason: "rejected" });
  });

  it("rejects a token solved on an unexpected hostname", async () => {
    respondWith({ success: true, action: "login", hostname: "evil.example.com" });

    expect(await verifyTurnstileToken(config, { token: "token-value" })).toEqual({ ok: false, reason: "rejected" });
  });

  it("skips the hostname check when no allowlist is configured", async () => {
    respondWith({ success: true, action: "login", hostname: "evil.example.com" });

    expect(await verifyTurnstileToken({ ...config, hostnames: [] }, { token: "token-value" })).toEqual({ ok: true });
  });

  it("reports siteverify outages separately from rejections", async () => {
    respondWith({}, false);

    expect(await verifyTurnstileToken(config, { token: "token-value" })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports network failures as unavailable", async () => {
    fetchMock = mock(async () => {
      throw new TypeError("fetch failed");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await verifyTurnstileToken(config, { token: "token-value" })).toEqual({ ok: false, reason: "unavailable" });
  });
});
