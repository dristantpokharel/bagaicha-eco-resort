const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for HTML element content and quoted attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Header-safe single line (subjects): collapses CR/LF so input can't inject headers. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}
