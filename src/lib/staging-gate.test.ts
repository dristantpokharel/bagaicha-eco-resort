import { describe, expect, it } from "vitest";
import { passwordMatches, stagingGate } from "./staging-gate";

const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;
const req = (authorization?: string) => new Request("https://staging.test/", { headers: authorization ? { authorization } : {} });

describe("staging gate", () => {
  it("is off without a password", () => {
    expect(stagingGate(req(), undefined)).toBeNull();
    expect(stagingGate(req(), "")).toBeNull();
  });
  it("challenges with a 401 when credentials are missing or wrong", () => {
    for (const r of [req(), req(basic("x", "nope")), req("Bearer abc"), req("Basic !!!")]) {
      const res = stagingGate(r, "secret");
      expect(res?.status).toBe(401);
      expect(res?.headers.get("www-authenticate")).toMatch(/^Basic/);
    }
  });
  it("accepts any username with the right password, including colons in it", () => {
    expect(stagingGate(req(basic("anyone", "secret")), "secret")).toBeNull();
    expect(stagingGate(req(basic("", "secret")), "secret")).toBeNull();
    expect(passwordMatches(basic("u", "pa:ss"), "pa:ss")).toBe(true);
  });
});
