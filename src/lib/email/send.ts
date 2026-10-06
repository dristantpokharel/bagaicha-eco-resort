import { singleLine } from "./escape";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult =
  | { ok: true; redirectedTo?: string }
  | { ok: false; reason: "not-configured" | "rejected" | "unreachable"; status?: number };

/**
 * Dev safety net: when EMAIL_DEV_TO is set, every email goes to that address
 * and the subject says who it was meant for. Unset in production.
 */
export function applyDevRedirect(message: EmailMessage, devTo: string | undefined): EmailMessage {
  const redirectTo = devTo?.trim();
  if (!redirectTo) return message;
  return { ...message, to: redirectTo, subject: `[DEV → ${singleLine(message.to)}] ${message.subject}` };
}

/** Sends through Resend's REST API. Never throws; callers decide what a failure means. */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, reason: "not-configured" };

  const outgoing = applyDevRedirect(message, process.env.EMAIL_DEV_TO);
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [outgoing.to],
        subject: singleLine(outgoing.subject),
        html: outgoing.html,
        text: outgoing.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, reason: "rejected", status: response.status };
    return { ok: true, redirectedTo: outgoing.to !== message.to ? outgoing.to : undefined };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
