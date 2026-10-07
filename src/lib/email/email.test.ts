import { afterEach, describe, expect, it, vi } from "vitest";
import { computeQuote } from "@/lib/booking/pricing";
import { parseDateOnly } from "@/lib/booking/dates";
import { escapeHtml, singleLine } from "./escape";
import { applyDevRedirect, sendEmail } from "./send";
import { bookingCancelledEmail, newRequestAlertEmail, requestReceivedEmail, type BookingEmailData } from "./templates";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const booking = (over: Partial<BookingEmailData> = {}): BookingEmailData => ({
  id: "b1",
  bookingNumber: "BG-2026-000007",
  guestName: "Sita Rai",
  guestEmail: "sita@example.com",
  guestPhone: "+9779800000000",
  checkIn: parseDateOnly("2026-11-10")!,
  checkOut: parseDateOnly("2026-11-12")!,
  adults: 2,
  children: 1,
  roomTypeName: "Family Room",
  roomName: null,
  quote: computeQuote({ nights: 2, pricePerNightNpr: 4500, childPricePerNightNpr: 500, children: 1 }),
  specialRequests: null,
  cancellationReason: null,
  terms: { checkInTime: "2:00 PM", checkOutTime: "11:00 AM", childUnderAge: 8, cancellationPolicy: "Plans changed? Tell us 24 hours ahead." },
  ...over,
});

describe("escapeHtml / singleLine", () => {
  it("escapes markup and quotes", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });
  it("removes line breaks from header values", () => {
    expect(singleLine("Hi\r\nBcc: evil@example.com")).toBe("Hi Bcc: evil@example.com");
  });
});

describe("templates", () => {
  it("includes number, dates, room, price breakdown, total and stay times", () => {
    const { html, text, subject } = requestReceivedEmail(booking());
    for (const body of [html, text]) {
      expect(body).toContain("BG-2026-000007");
      expect(body).toContain("Tue, 10 Nov 2026");
      expect(body).toContain("Family Room");
      expect(body).toContain("2 nights × NPR 4,500 = NPR 9,000");
      expect(body).toContain("2 nights × 1 child × NPR 500 = NPR 1,000");
      expect(body).toContain("NPR 10,000");
      expect(body).toContain("2:00 PM");
      expect(body).toContain("11:00 AM");
    }
    expect(subject).toContain("BG-2026-000007");
  });
  it("escapes every guest-supplied field", () => {
    const evil = `<img src=x onerror=alert(1)>`;
    const b = booking({ guestName: evil, specialRequests: evil, cancellationReason: evil });
    for (const email of [requestReceivedEmail(b), bookingCancelledEmail(b), newRequestAlertEmail(b, "https://x.test/a?b=1&c=2")]) {
      expect(email.html).not.toContain("<img");
      expect(email.html).toContain("&lt;img");
    }
  });
});

describe("dev redirect", () => {
  const msg = { to: "guest@example.com", subject: "Hello", html: "<p>x</p>", text: "x" };
  it("is a no-op without EMAIL_DEV_TO", () => {
    expect(applyDevRedirect(msg, undefined)).toEqual(msg);
    expect(applyDevRedirect(msg, "  ")).toEqual(msg);
  });
  it("redirects and names the intended recipient in the subject", () => {
    expect(applyDevRedirect(msg, "dev@example.com")).toMatchObject({
      to: "dev@example.com",
      subject: "[DEV → guest@example.com] Hello",
    });
  });
  it("sendEmail posts to the dev address only", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "from@example.com");
    vi.stubEnv("EMAIL_DEV_TO", "dev@example.com");
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendEmail(msg);
    const sent = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(sent.to).toEqual(["dev@example.com"]);
    expect(sent.subject).toContain("guest@example.com");
    expect(result).toEqual({ ok: true, redirectedTo: "dev@example.com" });
  });
  it("sends normally when EMAIL_DEV_TO is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "from@example.com");
    vi.stubEnv("EMAIL_DEV_TO", "");
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail(msg);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).to).toEqual(["guest@example.com"]);
  });
  it("reports not-configured and rejections without throwing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendEmail(msg)).toEqual({ ok: false, reason: "not-configured" });
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "from@example.com");
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 422 }));
    expect(await sendEmail(msg)).toEqual({ ok: false, reason: "rejected", status: 422 });
  });
});
