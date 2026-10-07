/**
 * Turns activity log rows into text for the admin Activity log page.
 *
 * Guest contact details stay out: the actions that write the log avoid them,
 * and this module is a second guard. Keys that can hold contact details or
 * free text typed about a guest are never shown, and any value that looks like
 * an email address or phone number is replaced.
 */

const HIDDEN_KEY = /e-?mail|phone|mobile|whats?app|password|token|hash|special_?requests|internal_?notes|guest_?notes/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{7,}\d/g;
/** Not phone numbers, even though they are long digit runs. */
const SAFE_NUMBERS = /BG-\d{4}-\d{6}|\d{4}-\d{2}-\d{2}/g;

export const HIDDEN = "[hidden]";
const MAX_VALUE_LENGTH = 200;

export function looksLikeContact(text: string): boolean {
  if (EMAIL.test(text)) return true;
  const candidates = text.replace(SAFE_NUMBERS, " ").match(PHONE_CANDIDATE) ?? [];
  return candidates.some((candidate) => candidate.replace(/\D/g, "").length >= 9);
}

function humanize(text: string): string {
  const words = text
    .replace(/[_.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "inventoryItem.created" → "Inventory item created". */
export function actionLabel(action: string): string {
  return humanize(action);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") {
    if (looksLikeContact(value)) return HIDDEN;
    return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value || "empty";
  }
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type DetailLine = { label: string; value: string };

/** Flattens a details object into "Label: value" lines, hiding sensitive keys and values. */
export function detailLines(details: unknown, prefix = ""): DetailLine[] {
  if (!isPlainObject(details)) return [];
  const lines: DetailLine[] = [];
  for (const [key, value] of Object.entries(details)) {
    const label = `${prefix}${humanize(key)}`;
    if (HIDDEN_KEY.test(key)) {
      lines.push({ label, value: HIDDEN });
    } else if (isPlainObject(value) && ("from" in value || "to" in value) && Object.keys(value).every((k) => k === "from" || k === "to")) {
      lines.push({ label, value: `${formatValue(value.from)} → ${formatValue(value.to)}` });
    } else if (isPlainObject(value)) {
      lines.push(...detailLines(value, `${label} · `));
    } else {
      lines.push({ label, value: formatValue(value) });
    }
  }
  return lines;
}

const text = (value: unknown) => (typeof value === "string" && value && !looksLikeContact(value) ? value : null);

/** Where an entity's page lives, or null when there isn't one (or the viewer can't open it). */
export function entityHref(params: {
  entityType: string;
  entityId: string | null;
  action: string;
  canManageUsers: boolean;
}): string | null {
  const { entityType, entityId, action, canManageUsers } = params;
  if (/\.(deleted|removed)$/.test(action)) return null;
  switch (entityType) {
    case "Booking":
    case "Reservation":
      return entityId ? `/admin/bookings/${entityId}` : null;
    case "InventoryItem":
      return entityId ? `/admin/inventory/${entityId}` : null;
    case "RoomType":
      return entityId ? `/admin/rooms/${entityId}` : null;
    case "Guest":
      return entityId ? `/admin/guests/${entityId}` : null;
    case "Room":
      return "/admin/rooms";
    case "RoomBlock":
      return "/admin/bookings/blocks";
    case "Enquiry":
      return "/admin/enquiries";
    case "Media":
    case "MediaPlacement":
      return "/admin/media";
    case "User":
      return canManageUsers ? "/admin/users" : null;
    default:
      return null;
  }
}

/** Short name for what the entry is about: booking number, item name, room… */
export function entityLabel(entityType: string, details: unknown): string {
  const d = isPlainObject(details) ? details : {};
  return text(d.reference) ?? text(d.bookingNumber) ?? text(d.item) ?? text(d.room) ?? text(d.name) ?? humanize(entityType);
}
