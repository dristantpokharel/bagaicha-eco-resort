import type { BookingStatus } from "@/generated/prisma/enums";
import type { StayTerms } from "@/lib/content/stay-terms";
import { SITE } from "@/config/site";
import { formatShortDate, formatStayDate } from "@/lib/booking/dates";
import { quoteLines, type Quote } from "@/lib/booking/pricing";
import { formatNpr } from "@/lib/money";
import { escapeHtml as esc, singleLine } from "./escape";
import { emailLogoUrl, EMAIL_LOGO_WIDTH } from "./logo";

/** One room line in an email, built from the line's own snapshots. */
export type EmailLine = {
  roomTypeName: string;
  /** Assigned room; null until confirmed. */
  roomName: string | null;
  adults: number;
  children: number;
  status: BookingStatus;
  quote: Quote;
  cancellationReason: string | null;
};

/** Everything a reservation email shows: every room with its guests and price. */
export type ReservationEmailData = {
  id: string;
  reference: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  lines: EmailLine[];
  specialRequests: string | null;
  /** Times and cancellation wording from the database (BusinessInfo, Policies). */
  terms: StayTerms;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const COLORS = { cream: "#F7F3E5", forest: "#283327", ink: "#2B2B2B", muted: "#5C6358", line: "#D9D4BF" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function guestsLabel(l: EmailLine, childUnderAge: number) {
  const adults = plural(l.adults, "adult", "adults");
  return l.children > 0 ? `${adults}, ${plural(l.children, "child", "children")} under ${childUnderAge}` : adults;
}

type Row = [label: string, value: string];

/** The lines of one room: type (and room), guests, then the price breakdown. */
function lineText(l: EmailLine, terms: StayTerms, options: { price: boolean }): string {
  const name = l.roomName ? `${l.roomTypeName} (${l.roomName})` : l.roomTypeName;
  const rows = [name, guestsLabel(l, terms.childUnderAge)];
  if (options.price) rows.push(...quoteLines(l.quote, formatNpr), `Room total: ${formatNpr(l.quote.totalPriceNpr)}`);
  if (l.cancellationReason) rows.push(`Reason: ${l.cancellationReason}`);
  return rows.join("\n");
}

const totalOf = (lines: EmailLine[]) => lines.reduce((n, l) => n + l.quote.totalPriceNpr, 0);

type Section = { heading: string | null; lines: EmailLine[]; price: boolean; unassigned?: string };

/** The stay facts that don't depend on the rooms. */
function stayRows(b: ReservationEmailData): Row[] {
  const rows: Row[] = [
    ["Reference", b.reference],
    ["Check-in", `${formatStayDate(b.checkIn)}${b.terms.checkInTime ? `, from ${b.terms.checkInTime}` : ""}`],
    ["Check-out", `${formatStayDate(b.checkOut)}${b.terms.checkOutTime ? `, by ${b.terms.checkOutTime}` : ""}`],
    ["Nights", String(b.nights)],
  ];
  if (b.specialRequests) rows.push(["Special requests", b.specialRequests]);
  return rows;
}

function roomsHtml(b: ReservationEmailData, sections: Section[]): string {
  return sections
    .map((section) => {
      const rows: Row[] = section.lines.map((l, i) => [
        `Room ${i + 1}`,
        lineText(l, b.terms, { price: section.price }) + (!l.roomName && section.unassigned ? `\n${section.unassigned}` : ""),
      ]);
      return `${section.heading ? `<h2 style="font-size:16px;color:${COLORS.forest};margin:20px 0 4px">${esc(section.heading)}</h2>` : ""}${table(rows)}`;
    })
    .join("");
}

function roomsText(b: ReservationEmailData, sections: Section[]): string[] {
  return sections.flatMap((section) => [
    ...(section.heading ? ["", section.heading] : []),
    ...section.lines.flatMap((l, i) => {
      const body = lineText(l, b.terms, { price: section.price }) + (!l.roomName && section.unassigned ? `\n${section.unassigned}` : "");
      const [first, ...rest] = body.split("\n");
      return [`Room ${i + 1}: ${first}`, ...rest.map((r) => `  ${r}`)];
    }),
  ]);
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

function policyBlock(b: ReservationEmailData) {
  const text = b.terms.cancellationPolicy;
  if (!text) return { html: "", text: "" };
  return {
    html: `<p style="font-size:13px;color:${COLORS.muted}"><strong>Cancellation policy:</strong> ${esc(text)}</p>`,
    text: `Cancellation policy: ${text}`,
  };
}

type Compose = {
  subject: string;
  title: string;
  intro: string;
  sections: Section[];
  /** The grand total line; null when the email shows no prices. */
  total: { label: string; lines: EmailLine[] } | null;
  outro?: string;
  policy?: boolean;
};

function compose(b: ReservationEmailData, c: Compose): RenderedEmail {
  const rows = stayRows(b);
  const policy = c.policy === false ? { html: "", text: "" } : policyBlock(b);
  const totalLine = c.total ? `${c.total.label}: ${formatNpr(totalOf(c.total.lines))}` : null;
  const html = layout(
    c.title,
    `<p style="font-size:15px;line-height:1.5">${esc(c.intro)}</p>
${table(rows)}
${roomsHtml(b, c.sections)}
${totalLine ? `<div style="margin-top:12px;font-size:14px;font-weight:bold">${esc(totalLine)}</div>` : ""}
${policy.html ? `<div style="margin-top:16px">${policy.html}</div>` : ""}
${c.outro ? `<p style="font-size:14px">${esc(c.outro)}</p>` : ""}`,
  );
  const text = [
    c.title,
    "",
    c.intro,
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    ...roomsText(b, c.sections),
    ...(totalLine ? ["", totalLine] : []),
    ...(policy.text ? ["", policy.text] : []),
    ...(c.outro ? ["", c.outro] : []),
    "",
    `${SITE.name}, ${SITE.address}`,
  ].join("\n");
  return { subject: singleLine(c.subject), html, text };
}

const kept = (b: ReservationEmailData) => b.lines.filter((l) => l.status !== "CANCELLED");
const countRooms = (n: number) => plural(n, "room", "rooms");

export function requestReceivedEmail(b: ReservationEmailData): RenderedEmail {
  return compose(b, {
    subject: `We received your request ${b.reference}`,
    title: "We've received your booking request",
    intro: `Hello ${b.guestName}, thank you for your request for ${countRooms(b.lines.length)}. It is not confirmed yet: we will check availability and confirm by email or phone.`,
    sections: [{ heading: null, lines: b.lines, price: true, unassigned: "Room assigned on confirmation" }],
    total: { label: "Total", lines: b.lines },
    outro: "Keep your reference handy if you contact us.",
  });
}

export function bookingConfirmedEmail(b: ReservationEmailData): RenderedEmail {
  return compose(b, {
    subject: `Booking confirmed ${b.reference}`,
    title: "Your booking is confirmed",
    intro: `Hello ${b.guestName}, your stay is confirmed (${countRooms(b.lines.length)}). We look forward to welcoming you.`,
    sections: [{ heading: null, lines: b.lines, price: true }],
    total: { label: "Total", lines: b.lines },
  });
}

/** Some rooms are confirmed and some could not be: says which, and why. */
export function bookingPartiallyConfirmedEmail(b: ReservationEmailData): RenderedEmail {
  const confirmed = kept(b);
  const declined = b.lines.filter((l) => l.status === "CANCELLED");
  return compose(b, {
    subject: `Booking partly confirmed ${b.reference}`,
    title: "Part of your booking is confirmed",
    intro: `Hello ${b.guestName}, we can confirm ${countRooms(confirmed.length)} of the ${b.lines.length} you asked for. We're sorry that ${declined.length === 1 ? "one room" : `${declined.length} rooms`} could not be confirmed.`,
    sections: [
      { heading: "Confirmed", lines: confirmed, price: true },
      { heading: "Could not be confirmed", lines: declined, price: false },
    ],
    total: { label: "Total for the confirmed rooms", lines: confirmed },
    outro: "If you would like to adjust your plans, please contact us.",
  });
}

export function bookingCancelledEmail(b: ReservationEmailData): RenderedEmail {
  return compose(b, {
    subject: `Booking cancelled ${b.reference}`,
    title: "Your booking has been cancelled",
    intro: `Hello ${b.guestName}, booking ${b.reference} has been cancelled.`,
    sections: [{ heading: null, lines: b.lines, price: false }],
    total: null,
    outro: "If this is a surprise, please contact us.",
    policy: false,
  });
}

/** Alert to the resort team. `adminUrl` points at the reservation in the admin portal. */
export function newRequestAlertEmail(b: ReservationEmailData, adminUrl: string): RenderedEmail {
  const sections: Section[] = [{ heading: null, lines: b.lines, price: true, unassigned: "Room not assigned yet" }];
  const rows: Row[] = [
    ["Guest", b.guestName],
    ["Email", b.guestEmail ?? "(none)"],
    ["Phone", b.guestPhone ?? "(none)"],
    ...stayRows(b),
    ["Rooms", String(b.lines.length)],
  ];
  const total = `Total: ${formatNpr(totalOf(b.lines))}`;
  const subject = singleLine(
    `New booking request ${b.reference}: ${countRooms(b.lines.length)}, ${formatShortDate(b.checkIn)} to ${formatShortDate(b.checkOut)}`,
  );
  const html = layout(
    "New booking request",
    `${table(rows)}
${roomsHtml(b, sections)}
<div style="margin-top:12px;font-size:14px;font-weight:bold">${esc(total)}</div>
<p style="margin-top:16px"><a href="${esc(adminUrl)}" style="color:${COLORS.forest}">Open in the admin portal</a></p>`,
  );
  const text = [
    "New booking request",
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    ...roomsText(b, sections),
    "",
    total,
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
