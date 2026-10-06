// Client-safe. One token per form attempt: a retry after a lost response reuses it,
// so the server can tell "same attempt again" from "a new movement".

export function newSubmissionId(): string {
  // randomUUID needs a secure context; staff may open the admin over plain http on a LAN.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
