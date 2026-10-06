import { z } from "zod";
import type { IconName } from "@/components/site/icons";
import { TOKEN_HELP } from "./tokens";

/**
 * One description per editable content collection. It drives the admin form, the
 * validation schema and the save action, so a field is declared exactly once.
 */

export type FieldKind = "text" | "textarea" | "lines" | "url" | "int" | "float" | "select" | "media" | "section";

export type Field = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  max?: number;
  hint?: string;
  rows?: number;
  placeholder?: string;
  options?: readonly { value: string; label: string }[];
  /** Checks each non-empty line (kind "lines"). Return an error message or null. */
  lineCheck?: (line: string) => string | null;
  min?: number;
  maxValue?: number;
};

export type CollectionKey =
  | "business"
  | "activities"
  | "diningSections"
  | "diningItems"
  | "eventTypes"
  | "faqs"
  | "policies"
  | "nearby";

export type Collection = {
  key: CollectionKey;
  label: string;
  singular: string;
  fields: readonly Field[];
  /** Field used as the row's heading in lists. */
  titleField: string;
  /** Rows have a URL slug made from this field when left blank. */
  slugFrom?: string;
  /** Single-row table (BusinessInfo). */
  singleton?: boolean;
  /** Fields that must be real (not placeholder) for a row to show in production. */
  requiredLive: readonly string[];
};

const URL_HINT = "Full address starting with https://";

const phoneLine = (line: string) => (/^\+?[0-9][0-9 ()-]{5,19}$/.test(line) ? null : `"${line}" is not a phone number.`);
const emailLine = (line: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line) ? null : `"${line}" is not an email address.`);

export const ICON_OPTIONS: readonly { value: IconName; label: string }[] = [
  { value: "plane", label: "Plane (airport / city)" },
  { value: "conservation", label: "Trees (conservation area)" },
  { value: "park", label: "Mountain (national park)" },
  { value: "bridge", label: "Bridge" },
  { value: "leaf", label: "Leaf" },
  { value: "food", label: "Food" },
  { value: "waves", label: "Water" },
  { value: "sun", label: "Sun" },
];

export const COLLECTIONS: Record<CollectionKey, Collection> = {
  business: {
    key: "business",
    label: "Business info",
    singular: "business info",
    titleField: "name",
    singleton: true,
    requiredLive: ["name"],
    fields: [
      { name: "name", label: "Business name", kind: "text", required: true, max: 120 },
      { name: "tagline", label: "Tagline", kind: "text", max: 160 },
      { name: "intro", label: "Intro line", kind: "text", max: 200, hint: "Shown under the hero and used as the default page description." },
      { name: "address", label: "Address", kind: "text", max: 240 },
      { name: "phones", label: "Phone numbers", kind: "lines", max: 5, lineCheck: phoneLine, hint: "One per line, main number first, with country code (+977…)." },
      { name: "whatsapp", label: "WhatsApp number", kind: "text", max: 20, hint: "With country code, digits only or +977… (used for the WhatsApp button)." },
      { name: "emails", label: "Email addresses", kind: "lines", max: 5, lineCheck: emailLine, hint: "One per line, main address first." },
      { name: "instagramUrl", label: "Instagram link", kind: "url", hint: URL_HINT },
      { name: "facebookUrl", label: "Facebook link", kind: "url", hint: URL_HINT },
      { name: "googleMapsUrl", label: "Google Maps link", kind: "url", hint: "Opens the place in Google Maps." },
      { name: "directionsUrl", label: "Get Directions link", kind: "url", hint: "Opens turn-by-turn directions." },
      { name: "checkInTime", label: "Check-in time", kind: "text", max: 20, hint: 'Shown as written, e.g. "2:00 PM". Used on the booking page, in emails and the FAQ.' },
      { name: "checkOutTime", label: "Check-out time", kind: "text", max: 20, hint: 'Shown as written, e.g. "11:00 AM".' },
      { name: "latitude", label: "Latitude", kind: "float", min: -90, maxValue: 90 },
      { name: "longitude", label: "Longitude", kind: "float", min: -180, maxValue: 180 },
    ],
  },
  activities: {
    key: "activities",
    label: "Activities",
    singular: "activity",
    titleField: "title",
    slugFrom: "title",
    requiredLive: ["title"],
    fields: [
      { name: "title", label: "Name", kind: "text", required: true, max: 80 },
      { name: "summary", label: "Short line", kind: "text", max: 200, hint: "One sentence shown on cards." },
      { name: "overview", label: "Overview", kind: "textarea", max: 1500, rows: 4 },
      { name: "duration", label: "Duration", kind: "text", max: 120 },
      { name: "bestTime", label: "Best time", kind: "text", max: 200 },
      { name: "whatToExpect", label: "What to expect", kind: "textarea", max: 1500, rows: 4 },
      { name: "coverMediaId", label: "Cover photo", kind: "media" },
    ],
  },
  diningSections: {
    key: "diningSections",
    label: "Dining",
    singular: "dining section",
    titleField: "title",
    requiredLive: ["title"],
    fields: [
      { name: "title", label: "Section name", kind: "text", required: true, max: 80 },
      { name: "description", label: "Description", kind: "textarea", max: 1500, rows: 3 },
    ],
  },
  diningItems: {
    key: "diningItems",
    label: "Dining items",
    singular: "dining item",
    titleField: "name",
    requiredLive: ["name"],
    fields: [
      { name: "sectionId", label: "Section", kind: "section", required: true },
      { name: "name", label: "Name", kind: "text", required: true, max: 120 },
      { name: "description", label: "Description", kind: "text", max: 300 },
      { name: "priceNpr", label: "Price (NPR)", kind: "int", min: 0, maxValue: 1_000_000, hint: "Whole rupees. Leave blank to show no price." },
    ],
  },
  eventTypes: {
    key: "eventTypes",
    label: "Event types",
    singular: "event type",
    titleField: "name",
    slugFrom: "name",
    requiredLive: ["name"],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 80 },
      { name: "summary", label: "Short line", kind: "text", max: 200 },
      { name: "description", label: "Description", kind: "textarea", max: 1500, rows: 4 },
      { name: "highlights", label: "Highlights", kind: "lines", max: 8, hint: "One per line, e.g. Meetings, Trainings." },
      { name: "coverMediaId", label: "Cover photo", kind: "media" },
    ],
  },
  faqs: {
    key: "faqs",
    label: "FAQs",
    singular: "FAQ",
    titleField: "question",
    requiredLive: ["question", "answer"],
    fields: [
      { name: "question", label: "Question", kind: "text", required: true, max: 200 },
      { name: "answer", label: "Answer", kind: "textarea", required: true, max: 2000, rows: 4, hint: TOKEN_HELP },
    ],
  },
  policies: {
    key: "policies",
    label: "Policies",
    singular: "policy",
    titleField: "title",
    slugFrom: "title",
    requiredLive: ["title", "body"],
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, max: 120 },
      { name: "body", label: "Text", kind: "textarea", required: true, max: 5000, rows: 8, hint: `Blank lines start a new paragraph. ${TOKEN_HELP}` },
    ],
  },
  nearby: {
    key: "nearby",
    label: "Nearby destinations",
    singular: "destination",
    titleField: "name",
    requiredLive: ["name"],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 120 },
      { name: "distance", label: "Distance", kind: "text", max: 40, hint: 'Shown as written, e.g. "~40 km".' },
      { name: "travelTime", label: "Travel time", kind: "text", max: 40, hint: 'Shown as written, e.g. "53 mins".' },
      { name: "icon", label: "Icon", kind: "select", options: ICON_OPTIONS },
    ],
  },
};

export function isCollectionKey(value: unknown): value is CollectionKey {
  return typeof value === "string" && value in COLLECTIONS;
}

const emptyToNull = (value: unknown) => (value == null || (typeof value === "string" && value.trim() === "") ? null : value);

function httpsUrl(max = 500) {
  return z
    .string()
    .trim()
    .max(max)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, { error: "Enter a full web address starting with https://" });
}

function fieldSchema(field: Field): z.ZodType {
  const max = field.max ?? 500;
  switch (field.kind) {
    case "text":
    case "textarea": {
      const base = z.string().trim().max(max, { error: `At most ${max} characters.` });
      return field.required ? base.min(1, { error: "Required." }) : z.preprocess(emptyToNull, base.nullable());
    }
    case "url":
      return z.preprocess(emptyToNull, httpsUrl().nullable());
    case "lines":
      return z
        .string()
        .default("")
        .transform((value, ctx) => {
          const lines = value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (lines.length > max) ctx.addIssue({ code: "custom", message: `At most ${max} lines.` });
          for (const line of lines) {
            if (line.length > 200) ctx.addIssue({ code: "custom", message: "A line is too long." });
            const problem = field.lineCheck?.(line);
            if (problem) ctx.addIssue({ code: "custom", message: problem });
          }
          return lines;
        });
    case "int":
    case "float": {
      let n = z.coerce.number({ error: "Enter a number." });
      if (field.kind === "int") n = n.int({ error: "Use a whole number." });
      if (field.min !== undefined) n = n.min(field.min, { error: `At least ${field.min}.` });
      if (field.maxValue !== undefined) n = n.max(field.maxValue, { error: `At most ${field.maxValue}.` });
      return z.preprocess((v) => (typeof v === "string" ? v.replace(/[,\s]/g, "") : v), z.preprocess(emptyToNull, n.nullable()));
    }
    case "select": {
      const allowed = (field.options ?? []).map((o) => o.value);
      return z.preprocess(emptyToNull, z.string().refine((v) => allowed.includes(v), { error: "Choose one." }).nullable());
    }
    case "media":
    case "section": {
      const id = z.string().trim().min(1).max(64);
      return field.required ? id : z.preprocess(emptyToNull, id.nullable());
    }
  }
}

/** Zod schema for one collection's form (plus display order, visibility and, for slugged rows, slug). */
export function buildSchema(collection: Collection) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of collection.fields) shape[field.name] = fieldSchema(field);
  if (!collection.singleton) {
    shape.sortOrder = z.preprocess(
      (v) => (v === "" || v == null ? 0 : v),
      z.coerce.number({ error: "Enter a number." }).int().min(0).max(999),
    );
    shape.isActive = z.preprocess((v) => v === "on" || v === "true", z.boolean());
  }
  if (collection.slugFrom) shape.slug = z.string().trim().toLowerCase().max(80).optional().default("");
  return z.object(shape);
}
