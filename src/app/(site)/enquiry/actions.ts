"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { enquirySchema } from "@/lib/booking/schemas";
import { notifyNewEnquiry } from "@/lib/email/booking-emails";
import { clientIpFromHeaders, hitRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { turnstileErrorMessage, verifyTurnstile } from "@/lib/turnstile";

export type EnquiryState =
  | null
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const FORM_FIELDS = ["name", "email", "phone", "type", "message"] as const;

/** Public endpoint: saves an enquiry. No sign-in; protected by Turnstile and rate limit. */
export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const values = Object.fromEntries(FORM_FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const fail = (error: string, fieldErrors?: Record<string, string>) =>
    ({ ok: false, error, fieldErrors, values }) as const;

  try {
    const parsed = enquirySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return fail("Please fix the highlighted fields.", fieldErrors);
    }
    const input = parsed.data;
    if (input.website) return fail("Something went wrong. Please reload the page and try again.");

    const ip = clientIpFromHeaders(await headers());
    const limit = await hitRateLimit("enquiry", ip);
    if (!limit.allowed) return fail(rateLimitMessage(limit.retryAfterSeconds));

    const human = await verifyTurnstile(input.turnstileToken, { ip, expectedAction: "enquiry" });
    if (!human.ok) return fail(turnstileErrorMessage(human.reason));

    const enquiry = await db.$transaction(async (tx) => {
      const created = await tx.enquiry.create({
        data: {
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          type: input.type,
          message: input.message,
        },
      });
      await logActivity(tx, {
        userId: null,
        action: "enquiry.created",
        entityType: "Enquiry",
        entityId: created.id,
        details: { type: created.type },
      });
      return created;
    });

    // Saved. A failed alert email is logged but must not turn this into an error for the guest.
    try {
      await notifyNewEnquiry(enquiry.id);
    } catch {
      // logged inside notifyNewEnquiry where possible
    }
    return { ok: true };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    console.error("Enquiry failed:", error instanceof Error ? error.name : "unknown error", code);
    return fail("Something went wrong and your enquiry was not sent. Please try again, or contact us directly.");
  }
}
