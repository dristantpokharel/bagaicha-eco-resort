import { isStaging } from "@/lib/site-env";
import { singleLine } from "./escape";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** What actually goes to Resend: one or more recipients. */
export type OutgoingEmail = Omit<EmailMessage, "to"> & { to: string[] };

export type SendResult =
  | { ok: true; redirectedTo?: string[] }
  | { ok: false; reason: "not-configured" | "rejected" | "unreachable"; status?: number };

/** EMAIL_DEV_TO: one address or a comma-separated list. Blank entries and repeats are dropped. */
export function parseAddressList(value: string | undefined): string[] {
  const list = (value ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  return [...new Set(list)];
}

/**
 * Dev safety net: when EMAIL_DEV_TO is set, every email goes to those addresses
 * and the subject says who it was meant for. Unset in production.
 */
export function applyDevRedirect(message: EmailMessage, devTo: string | undefined): OutgoingEmail {
  const redirectTo = parseAddressList(devTo);
  if (redirectTo.length === 0) return { ...message, to: [message.to] };
  return { ...message, to: redirectTo, subject: `[DEV → ${singleLine(message.to)}] ${message.subject}` };
}

/** Sends through Resend's REST API. Never throws; callers decide what a failure means. */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, reason: "not-configured" };

  const devTo = process.env.EMAIL_DEV_TO;
  // A staging site must never email real guests: no safe address list, no send.
  if (isStaging && parseAddressList(devTo).length === 0) return { ok: false, reason: "not-configured" };

  const outgoing = applyDevRedirect(message, devTo);
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: outgoing.to,
        subject: singleLine(outgoing.subject),
        html: outgoing.html,
        text: outgoing.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, reason: "rejected", status: response.status };
    return { ok: true, redirectedTo: outgoing.subject !== message.subject ? outgoing.to : undefined };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
