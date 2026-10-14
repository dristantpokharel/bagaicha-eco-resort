/**
 * One CSV cell. Quotes when needed, and defuses spreadsheet formulas: a cell starting with = + - @ (or a tab/CR)
 * would run as a formula in Excel or Sheets, and item names and notes are typed by staff.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  // BOM so Excel reads UTF-8; CRLF per RFC 4180.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
