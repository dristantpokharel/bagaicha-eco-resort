import { formatDateTime } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import type { Overview } from "./overview";

export const OVERVIEW_TABLES = ["to-buy", "stock", "rooms", "losses"] as const;
export type OverviewTable = (typeof OVERVIEW_TABLES)[number];

export const OVERVIEW_TABLE_LABELS: Record<OverviewTable, string> = {
  "to-buy": "To buy",
  stock: "Stock by place",
  rooms: "Rooms against par",
  losses: "Lost or damaged this month",
};

export function parseOverviewTable(value: string | null): OverviewTable | null {
  return OVERVIEW_TABLES.find((t) => t === value) ?? null;
}

/** One table of the overview as CSV. Numbers are plain (no units) so a spreadsheet can add them up. */
export function overviewCsv(table: OverviewTable, o: Overview): string {
  switch (table) {
    case "to-buy":
      return toCsv(
        ["Item", "Category", "Unit", "Have", "Alert at", "Arrivals/rooms short by", "Buy at least"],
        o.toBuy.map((r) => [r.name, r.category, r.unit, r.have, r.alertAt, r.arrivalsShort, r.buy]),
      );
    case "stock":
      return toCsv(
        ["Item", "Category", "Unit", "Type", "Store", "Laundry", "In rooms", "Total", "Unit cost (NPR)"],
        o.stock.map((s) => [s.name, s.category, s.unit, s.isConsumable ? "Consumable" : "Reusable", s.store, s.laundry, s.rooms, s.total, s.unitCostNpr]),
      );
    case "rooms":
      return toCsv(
        ["Room", ...o.grid.columns.map((c) => `${c.name} (have/par)`)],
        o.grid.rows.map((r) => [r.roomName, ...o.grid.columns.map((c) => (r.cells[c.id] ? `${r.cells[c.id].have}/${r.cells[c.id].par}` : ""))]),
      );
    case "losses":
      return toCsv(
        ["When", "Item", "Unit", "Type", "Quantity", "Where", "Note"],
        o.losses.details.map((d) => [formatDateTime(d.at), d.item, d.unit, d.type === "LOST" ? "Lost" : "Damaged", d.quantity, d.where, d.note]),
      );
  }
}
