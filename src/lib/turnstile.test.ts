import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

// Cloudflare's official Turnstile testing keys and dummy token.
const TEST_SECRET_PASS = "1x0000000000000000000000000000000AA";
const TEST_SECRET_FAIL = "2x0000000000000000000000000000000AA";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: () => Promise<Response>) {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => impl());
  vi.stubGlobal("fetch", fn);
  return fn;
}
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("verifyTurnstile (mocked Cloudflare)", () => {
  it("rejects a missing token without calling Cloudflare", async () => {
    const fetchMock = stubFetch(() => json({ success: true }));
    expect(await verifyTurnstile(undefined, { secret: "s" })).toEqual({ ok: false, reason: "missing-token" });
    expect(await verifyTurnstile("", { secret: "s" })).toEqual({ ok: false, reason: "missing-token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed when no secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchMock = stubFetch(() => json({ success: true }));
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
  it("accepts success and sends secret, token and IP", async () => {
    const fetchMock = stubFetch(() => json({ success: true, action: "booking" }));
    expect(await verifyTurnstile("tok", { secret: "s", ip: "1.2.3.4", expectedAction: "booking" })).toEqual({ ok: true });
    const body = fetchMock.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get("secret")).toBe("s");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });
  it("rejects failure, wrong action, HTTP errors and network errors", async () => {
    stubFetch(() => json({ success: false }));
    expect(await verifyTurnstile("tok", { secret: "s" })).toEqual({ ok: false, reason: "failed" });
    stubFetch(() => json({ success: true, action: "enquiry" }));
    expect(await verifyTurnstile("tok", { secret: "s", expectedAction: "booking" })).toEqual({ ok: false, reason: "failed" });
    stubFetch(() => json({}, 500));
    expect(await verifyTurnstile("tok", { secret: "s" })).toEqual({ ok: false, reason: "unreachable" });
    stubFetch(() => Promise.reject(new Error("offline")));
    expect(await verifyTurnstile("tok", { secret: "s" })).toEqual({ ok: false, reason: "unreachable" });
  });
});

// Opt-in: one real call each to Cloudflare, using only the official test keys.
// Run with: RUN_LIVE_TURNSTILE=1 npm test
describe.skipIf(!process.env.RUN_LIVE_TURNSTILE)("verifyTurnstile (live, official test keys)", () => {
  it("passes with the always-pass key", async () => {
    expect(await verifyTurnstile(DUMMY_TOKEN, { secret: TEST_SECRET_PASS })).toEqual({ ok: true });
  });
  it("fails with the always-fail key", async () => {
    expect(await verifyTurnstile(DUMMY_TOKEN, { secret: TEST_SECRET_FAIL })).toEqual({ ok: false, reason: "failed" });
  });
});
