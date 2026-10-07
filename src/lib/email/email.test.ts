import { afterEach, describe, expect, it, vi } from "vitest";
import { computeQuote } from "@/lib/booking/pricing";
import { parseDateOnly } from "@/lib/booking/dates";
import { escapeHtml, singleLine } from "./escape";
import { applyDevRedirect, sendEmail } from "./send";
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingPartiallyConfirmedEmail,
  newRequestAlertEmail,
  requestReceivedEmail,
  type EmailLine,
  type ReservationEmailData,
} from "./templates";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const line = (over: Partial<EmailLine> = {}): EmailLine => ({
  roomTypeName: "Family Room",
  roomName: null,
  adults: 2,
  children: 1,
  status: "PENDING",
  cancellationReason: null,
  quote: computeQuote({ nights: 2, pricePerNightNpr: 4500, childPricePerNightNpr: 500, children: 1 }),
  ...over,
});

const reservation = (over: Partial<ReservationEmailData> = {}): ReservationEmailData => ({
  id: "r1",
  reference: "BG-2026-000007",
  guestName: "Sita Rai",
  guestEmail: "sita@example.com",
  guestPhone: "+9779800000000",
  checkIn: parseDateOnly("2026-11-10")!,
  checkOut: parseDateOnly("2026-11-12")!,
  nights: 2,
  lines: [line()],
  specialRequests: null,
  terms: { checkInTime: "2:00 PM", checkOutTime: "11:00 AM", childUnderAge: 8, cancellationPolicy: "Plans changed? Tell us 24 hours ahead." },
  ...over,
});

const deluxeLine = (over: Partial<EmailLine> = {}) =>
  line({ roomTypeName: "Deluxe Room", adults: 2, children: 0, quote: computeQuote({ nights: 2, pricePerNightNpr: 3000, childPricePerNightNpr: 500, children: 0 }), ...over });

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
  it("includes reference, dates, room, price breakdown, total and stay times", () => {
    const { html, text, subject } = requestReceivedEmail(reservation());
    for (const body of [html, text]) {
      expect(body).toContain("BG-2026-000007");
      expect(body).toContain("Tue, 10 Nov 2026");
      expect(body).toContain("Family Room");
      expect(body).toContain("2 adults, 1 child under 8");
      expect(body).toContain("2 nights × NPR 4,500 = NPR 9,000");
      expect(body).toContain("2 nights × 1 child × NPR 500 = NPR 1,000");
      expect(body).toContain("NPR 10,000");
      expect(body).toContain("2:00 PM");
      expect(body).toContain("11:00 AM");
    }
    expect(subject).toContain("BG-2026-000007");
  });

  it("lists every room with its own guests and price, then the grand total (2 Deluxe + 1 Family)", () => {
    const b = reservation({ lines: [deluxeLine(), deluxeLine({ adults: 1 }), line({ adults: 3, children: 2, quote: computeQuote({ nights: 2, pricePerNightNpr: 4500, childPricePerNightNpr: 500, children: 2 }) })] });
    const { html, text } = requestReceivedEmail(b);
    for (const body of [html, text]) {
      expect(body).toContain("Room 1");
      expect(body).toContain("Room 3");
      expect(body.match(/Deluxe Room/g)).toHaveLength(2);
      expect(body).toContain("1 adult");
      expect(body).toContain("3 adults, 2 children under 8");
      expect(body).toContain("Room total: NPR 6,000");
      expect(body).toContain("Room total: NPR 11,000");
      expect(body).toContain("Total: NPR 23,000");
      expect(body).toContain("Room assigned on confirmation");
    }
  });

  it("confirmed email shows the assigned room of each line", () => {
    const b = reservation({ lines: [deluxeLine({ status: "CONFIRMED", roomName: "201" }), line({ status: "CONFIRMED", roomName: "F1" })] });
    const { text, subject } = bookingConfirmedEmail(b);
    expect(text).toContain("Deluxe Room (201)");
    expect(text).toContain("Family Room (F1)");
    expect(subject).toContain("confirmed");
  });

  it("partially confirmed email says which rooms are confirmed and which couldn't be, and totals the confirmed ones", () => {
    const b = reservation({
      lines: [
        deluxeLine({ status: "CONFIRMED", roomName: "201" }),
        deluxeLine({ status: "CONFIRMED", roomName: "202" }),
        line({ status: "CANCELLED", cancellationReason: "Closed for maintenance" }),
      ],
    });
    const { html, text, subject } = bookingPartiallyConfirmedEmail(b);
    for (const body of [html, text]) {
      expect(body).toContain("Confirmed");
      expect(body).toContain("Could not be confirmed");
      expect(body).toContain("Deluxe Room (201)");
      expect(body).toContain("Deluxe Room (202)");
      expect(body).toContain("Reason: Closed for maintenance");
      expect(body).toContain("Total for the confirmed rooms: NPR 12,000");
    }
    expect(text.indexOf("Confirmed")).toBeLessThan(text.indexOf("Could not be confirmed"));
    expect(text.indexOf("Family Room")).toBeGreaterThan(text.indexOf("Could not be confirmed"));
    expect(subject).toContain("partly confirmed");
  });

  it("cancelled email lists every room with its reason and no prices", () => {
    const b = reservation({ lines: [deluxeLine({ status: "CANCELLED", cancellationReason: "Guest asked" }), line({ status: "CANCELLED", cancellationReason: "Guest asked" })] });
    const { text } = bookingCancelledEmail(b);
    expect(text).toContain("Deluxe Room");
    expect(text).toContain("Family Room");
    expect(text).toContain("Reason: Guest asked");
    expect(text).not.toContain("NPR");
  });

  it("resort alert lists all rooms and links to the reservation", () => {
    const { text, subject } = newRequestAlertEmail(reservation({ lines: [deluxeLine(), line()] }), "https://x.test/admin/bookings/r1");
    expect(text).toContain("Room 2");
    expect(text).toContain("Total: NPR 16,000");
    expect(text).toContain("https://x.test/admin/bookings/r1");
    expect(subject).toContain("2 rooms");
  });

  it("escapes every guest-supplied field, in every room line", () => {
    const evil = `<img src=x onerror=alert(1)>`;
    const b = reservation({
      guestName: evil,
      specialRequests: evil,
      lines: [line({ status: "CANCELLED", cancellationReason: evil }), line({ status: "CONFIRMED", roomName: evil, roomTypeName: evil })],
    });
    for (const email of [
      requestReceivedEmail(b),
      bookingConfirmedEmail(b),
      bookingPartiallyConfirmedEmail(b),
      bookingCancelledEmail(b),
      newRequestAlertEmail(b, "https://x.test/a?b=1&c=2"),
    ]) {
      expect(email.html).not.toContain("<img");
      expect(email.html).toContain("&lt;img");
    }
  });
});

describe("dev redirect", () => {
  const msg = { to: "guest@example.com", subject: "Hello", html: "<p>x</p>", text: "x" };
  it("is a no-op without EMAIL_DEV_TO", () => {
    expect(applyDevRedirect(msg, undefined)).toEqual({ ...msg, to: ["guest@example.com"] });
    expect(applyDevRedirect(msg, "  ")).toEqual({ ...msg, to: ["guest@example.com"] });
    expect(applyDevRedirect(msg, " , ")).toEqual({ ...msg, to: ["guest@example.com"] });
  });
  it("accepts a comma-separated list, trimmed and de-duplicated", () => {
    expect(applyDevRedirect(msg, " a@example.com, b@example.com ,,a@example.com").to).toEqual(["a@example.com", "b@example.com"]);
  });
  it("redirects and names the intended recipient in the subject", () => {
    expect(applyDevRedirect(msg, "dev@example.com")).toMatchObject({
      to: ["dev@example.com"],
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
    expect(result).toEqual({ ok: true, redirectedTo: ["dev@example.com"] });
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
  it("sends to every address in a comma-separated EMAIL_DEV_TO", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "from@example.com");
    vi.stubEnv("EMAIL_DEV_TO", "a@example.com, b@example.com");
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail(msg);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).to).toEqual(["a@example.com", "b@example.com"]);
  });
  it("on staging, refuses to send unless EMAIL_DEV_TO is set", async () => {
    vi.stubEnv("SITE_ENV", "staging");
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "from@example.com");
    vi.stubEnv("EMAIL_DEV_TO", "");
    vi.resetModules();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail: stagingSend } = await import("./send");
    expect(await stagingSend(msg)).toEqual({ ok: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
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
