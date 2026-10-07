import { BOOKING } from "@/config/booking";
import type { StayTerms } from "@/lib/content/stay-terms";
import { SITE } from "@/config/site";
import { formatShortDate, formatStayDate } from "@/lib/booking/dates";
import { quoteLines, type Quote } from "@/lib/booking/pricing";
import { formatNpr } from "@/lib/money";
import { escapeHtml as esc, singleLine } from "./escape";
import { emailLogoUrl, EMAIL_LOGO_WIDTH } from "./logo";

/** Everything a booking email shows. Built from the booking's own snapshots. */
export type BookingEmailData = {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  roomTypeName: string;
  /** Assigned room; null until confirmed. */
  roomName: string | null;
  quote: Quote;
  specialRequests: string | null;
  cancellationReason: string | null;
  /** Times and cancellation wording from the database (BusinessInfo, Policies). */
  terms: StayTerms;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const COLORS = { cream: "#F7F3E5", forest: "#283327", ink: "#2B2B2B", muted: "#5C6358", line: "#D9D4BF" };

function guestsLabel(b: BookingEmailData) {
  const adults = `${b.adults} adult${b.adults === 1 ? "" : "s"}`;
  return b.children > 0 ? `${adults}, ${b.children} child${b.children === 1 ? "" : "ren"} under ${BOOKING.childUnderAge}` : adults;
}

type Row = [label: string, value: string];

function bookingRows(b: BookingEmailData): Row[] {
  const rows: Row[] = [
    ["Booking number", b.bookingNumber],
    ["Check-in", `${formatStayDate(b.checkIn)}${b.terms.checkInTime ? `, from ${b.terms.checkInTime}` : ""}`],
    ["Check-out", `${formatStayDate(b.checkOut)}${b.terms.checkOutTime ? `, by ${b.terms.checkOutTime}` : ""}`],
    ["Nights", String(b.quote.nights)],
    ["Room", b.roomName ? `${b.roomTypeName} (${b.roomName})` : `${b.roomTypeName} (room assigned on confirmation)`],
    ["Guests", guestsLabel(b)],
  ];
  if (b.specialRequests) rows.push(["Special requests", b.specialRequests]);
  return rows;
}

function priceBlock(b: BookingEmailData) {
  const lines = quoteLines(b.quote, formatNpr);
  const html =
    lines.map((l) => `<div style="color:${COLORS.muted}">${esc(l)}</div>`).join("") +
    `<div style="margin-top:6px;font-weight:bold">Total: ${esc(formatNpr(b.quote.totalPriceNpr))}</div>`;
  const text = [...lines, `Total: ${formatNpr(b.quote.totalPriceNpr)}`].join("\n");
  return { html, text };
}

/** Logo image (PNG; mail apps drop SVG) or, when Cloudinary isn't configured, the plain name. */
function header(): string {
  const logo = emailLogoUrl();
  if (!logo) return `<div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest}">${esc(SITE.name)}</div>`;
  return `<img src="${esc(logo)}" width="${EMAIL_LOGO_WIDTH}" alt="${esc(SITE.name)}" style="display:block;border:0;height:auto;width:${EMAIL_LOGO_WIDTH}px">`;
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:${COLORS.cream};font-family:Arial,Helvetica,sans-serif;color:${COLORS.ink}">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
${header()}
<h1 style="font-size:22px;color:${COLORS.forest};margin:12px 0 16px">${esc(title)}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid ${COLORS.line};margin:24px 0 12px">
<div style="font-size:12px;color:${COLORS.muted}">${esc(SITE.name)}, ${esc(SITE.address)}</div>
</div></body></html>`;
}

function table(rows: Row[]): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:${COLORS.muted};vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:6px 0">${esc(value).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("")}</table>`;
}

function policyBlock(b: BookingEmailData) {
  const text = b.terms.cancellationPolicy;
  if (!text) return { html: "", text: "" };
  return {
    html: `<p style="font-size:13px;color:${COLORS.muted}"><strong>Cancellation policy:</strong> ${esc(text)}</p>`,
    text: `Cancellation policy: ${text}`,
  };
}

function compose(subject: string, title: string, intro: string, b: BookingEmailData, outro?: string): RenderedEmail {
  const rows = bookingRows(b);
  const price = priceBlock(b);
  const policy = policyBlock(b);
  const html = layout(
    title,
    `<p style="font-size:15px;line-height:1.5">${esc(intro)}</p>
${table(rows)}
<div style="margin-top:12px;font-size:14px">${price.html}</div>
${policy.html ? `<div style="margin-top:16px">${policy.html}</div>` : ""}
${outro ? `<p style="font-size:14px">${esc(outro)}</p>` : ""}`,
  );
  const text = [
    title,
    "",
    intro,
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    "",
    price.text,
    ...(policy.text ? ["", policy.text] : []),
    ...(outro ? ["", outro] : []),
    "",
    `${SITE.name}, ${SITE.address}`,
  ].join("\n");
  return { subject: singleLine(subject), html, text };
}

export function requestReceivedEmail(b: BookingEmailData): RenderedEmail {
  return compose(
    `We received your request ${b.bookingNumber}`,
    "We've received your booking request",
    `Hello ${b.guestName}, thank you for your request. It is not confirmed yet: we will check availability and confirm by email or phone.`,
    b,
    "Keep your booking number handy if you contact us.",
  );
}

export function bookingConfirmedEmail(b: BookingEmailData): RenderedEmail {
  return compose(
    `Booking confirmed ${b.bookingNumber}`,
    "Your booking is confirmed",
    `Hello ${b.guestName}, your stay is confirmed. We look forward to welcoming you.`,
    b,
  );
}

export function bookingCancelledEmail(b: BookingEmailData): RenderedEmail {
  const reason = b.cancellationReason ? ` Reason: ${b.cancellationReason}` : "";
  return compose(
    `Booking cancelled ${b.bookingNumber}`,
    "Your booking has been cancelled",
    `Hello ${b.guestName}, booking ${b.bookingNumber} has been cancelled.${reason}`,
    b,
    "If this is a surprise, please contact us.",
  );
}

/** Alert to the resort team. `adminUrl` points at the booking in the admin portal. */
export function newRequestAlertEmail(b: BookingEmailData, adminUrl: string): RenderedEmail {
  const rows: Row[] = [
    ["Guest", b.guestName],
    ["Email", b.guestEmail ?? "(none)"],
    ["Phone", b.guestPhone ?? "(none)"],
    ...bookingRows(b),
  ];
  const price = priceBlock(b);
  const subject = singleLine(
    `New booking request ${b.bookingNumber}: ${formatShortDate(b.checkIn)} to ${formatShortDate(b.checkOut)}`,
  );
  const html = layout(
    "New booking request",
    `${table(rows)}
<div style="margin-top:12px;font-size:14px">${price.html}</div>
<p style="margin-top:16px"><a href="${esc(adminUrl)}" style="color:${COLORS.forest}">Open in the admin portal</a></p>`,
  );
  const text = [
    "New booking request",
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    "",
    price.text,
    "",
    `Open in the admin portal: ${adminUrl}`,
  ].join("\n");
  return { subject, html, text };
}

export type EnquiryEmailData = {
  name: string;
  email: string | null;
  phone: string | null;
  typeLabel: string;
  message: string;
};

export function newEnquiryAlertEmail(e: EnquiryEmailData, adminUrl: string): RenderedEmail {
  const rows: Row[] = [
    ["Name", e.name],
    ["Email", e.email ?? "(none)"],
    ["Phone", e.phone ?? "(none)"],
    ["Type", e.typeLabel],
    ["Message", e.message],
  ];
  const html = layout(
    "New enquiry",
    `${table(rows)}<p style="margin-top:16px"><a href="${esc(adminUrl)}" style="color:${COLORS.forest}">Open enquiries in the admin portal</a></p>`,
  );
  const text = ["New enquiry", "", ...rows.map(([l, v]) => `${l}: ${v}`), "", `Open enquiries: ${adminUrl}`].join("\n");
  return { subject: singleLine(`New enquiry from ${e.name}`), html, text };
}
