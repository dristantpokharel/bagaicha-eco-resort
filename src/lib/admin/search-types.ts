/** Shared by the search code (server) and the search box (client); keep this file free of server imports. */
export const SEARCH_MIN_CHARS = 2;

export type SearchKind = "reservation" | "guest" | "enquiry" | "inventory";
export type ChipTone = "neutral" | "pending" | "good" | "bad" | "info";
export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  chip?: { label: string; tone: ChipTone };
};
export type SearchGroup = { kind: SearchKind; label: string; hits: SearchHit[] };
