import { requirePagePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatNpr } from "@/lib/money";
import { loadOverview, monthStartInResort } from "@/lib/inventory/overview";
import { OVERVIEW_TABLES, OVERVIEW_TABLE_LABELS } from "@/lib/inventory/overview-csv";
import { formatQuantity, formatQuantityWithUnit } from "@/lib/inventory/format";
import { formatInTimeZone } from "date-fns-tz";
import { RESORT_TIMEZONE } from "@/lib/dates";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { PrintButton } from "./print-button";

export const metadata = { title: "Inventory overview" };

const CELL_STYLE = {
  short: "bg-error/10 font-semibold text-error",
  over: "bg-warning/15 font-semibold text-warning",
  ok: "text-charcoal",
} as const;
const CELL_MARK = { short: "▼ ", over: "▲ ", ok: "" } as const;
const CELL_WORD = { short: "short", over: "over", ok: "ok" } as const;

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-8 break-inside-avoid-page">
      <h2 id={id} className="font-display text-lg text-forest">
        {title}
      </h2>
      {hint && <p className="mb-3 text-sm text-charcoal-light">{hint}</p>}
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-6 text-center text-sm text-charcoal-light">{children}</p>
);

const th = "px-3 py-2 text-left text-xs font-medium text-charcoal-light";
const td = "px-3 py-2 align-top";

export default async function OverviewPage() {
  await requirePagePermission("inventory.overview");
  const o = await loadOverview();
  const monthName = formatInTimeZone(monthStartInResort(), RESORT_TIMEZONE, "MMMM yyyy");
  const allBuyZero = o.toBuy.length === 0;

  return (
    <>
      <PageHeader
        title="Inventory overview"
        description="What to buy, whether the rooms are stocked, and what is lost. Updated every time this page opens."
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
          </div>
        }
      />

      <Section
        id="to-buy"
        title="What to buy"
        hint={`Items running low, plus what rooms need for the ${o.arrivalCount} ${o.arrivalCount === 1 ? "arrival" : "arrivals"} in the next ${o.windowDays} days or were left short at room prep, which the Store and Laundry can't cover.`}
      >
        {allBuyZero ? (
          <Empty>Nothing to buy right now.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-forest/10 bg-forest/5">
                <tr>
                  <th className={th}>Item</th>
                  <th className={th}>Have</th>
                  <th className={th}>Alert at</th>
                  <th className={th}>Rooms short by</th>
                  <th className={th}>Buy at least</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {o.toBuy.map((r) => (
                  <tr key={r.itemId}>
                    <td className={td}>
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-xs text-charcoal-light">{r.category}</span>
                    </td>
                    <td className={td}>{formatQuantityWithUnit(r.have, r.unit)}</td>
                    <td className={td}>{Number(r.alertAt) > 0 ? formatQuantity(r.alertAt) : "—"}</td>
                    <td className={td}>{Number(r.arrivalsShort) > 0 ? formatQuantity(r.arrivalsShort) : "—"}</td>
                    <td className={`${td} font-semibold`}>{Number(r.buy) > 0 ? formatQuantityWithUnit(r.buy, r.unit) : "Low"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        id="rooms"
        title="Are the rooms stocked?"
        hint="Reusable items in each room against its par list, as have / should have. ▼ short, ▲ more than it should have."
      >
        {o.grid.columns.length === 0 ? (
          <Empty>
            No par lists yet. Set one under Rooms, then the room type, then Par list.
          </Empty>
        ) : (
          <>
            <p className="mb-2 text-sm">
              <strong className="text-error">{o.grid.shortCells}</strong> short · <strong className="text-warning">{o.grid.overCells}</strong> over
            </p>
            <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-forest/10 bg-forest/5">
                  <tr>
                    <th className={`${th} sticky left-0 bg-forest/5`}>Room</th>
                    {o.grid.columns.map((c) => (
                      <th key={c.id} className={`${th} whitespace-nowrap`}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/10">
                  {o.grid.rows.map((row) => (
                    <tr key={row.roomId}>
                      <th scope="row" className={`${td} sticky left-0 bg-white text-left font-medium`}>
                        {row.roomName}
                      </th>
                      {o.grid.columns.map((c) => {
                        const cell = row.cells[c.id];
                        return (
                          <td key={c.id} className={`${td} whitespace-nowrap ${cell ? CELL_STYLE[cell.state] : "text-charcoal-light"}`}>
                            {cell ? (
                              <>
                                {CELL_MARK[cell.state]}
                                {formatQuantity(cell.have)} / {formatQuantity(cell.par)}
                                <span className="sr-only"> ({CELL_WORD[cell.state]})</span>
                              </>
                            ) : (
                              ""
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section id="stock" title="What we have and where" hint="Reusable items by place. Consumables have one total, not a place.">
        {o.stock.length === 0 ? (
          <Empty>No items yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-forest/10 bg-forest/5">
                <tr>
                  <th className={th}>Item</th>
                  <th className={th}>Store</th>
                  <th className={th}>Laundry</th>
                  <th className={th}>In rooms</th>
                  <th className={th}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {o.stock.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>
                      <span className="font-medium">{s.name}</span>
                      <span className="block text-xs text-charcoal-light">{s.category}</span>
                    </td>
                    <td className={td}>{s.store === null ? "—" : formatQuantity(s.store)}</td>
                    <td className={td}>{s.laundry === null ? "—" : formatQuantity(s.laundry)}</td>
                    <td className={td}>{s.rooms === null ? "—" : formatQuantity(s.rooms)}</td>
                    <td className={`${td} font-medium`}>{formatQuantityWithUnit(s.total, s.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="losses" title={`Lost or damaged in ${monthName}`}>
        {o.losses.items.length === 0 ? (
          <Empty>Nothing lost or damaged this month.</Empty>
        ) : (
          <>
            <p className="mb-2 text-sm">
              Cost so far: <strong>{formatNpr(o.losses.totalCostNpr)}</strong>
              {o.losses.itemsWithoutCost > 0 && (
                <span className="text-charcoal-light">
                  {" "}
                  (not counting {o.losses.itemsWithoutCost} {o.losses.itemsWithoutCost === 1 ? "item" : "items"} with no unit cost set)
                </span>
              )}
            </p>
            <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-forest/10 bg-forest/5">
                  <tr>
                    <th className={th}>Item</th>
                    <th className={th}>Lost</th>
                    <th className={th}>Damaged</th>
                    <th className={th}>Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/10">
                  {o.losses.items.map((i) => (
                    <tr key={i.itemId}>
                      <td className={`${td} font-medium`}>{i.name}</td>
                      <td className={td}>{formatQuantity(i.lost)}</td>
                      <td className={td}>{formatQuantity(i.damaged)}</td>
                      <td className={td}>{i.costNpr === null ? "Unit cost not set" : formatNpr(i.costNpr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="mt-3 print:open">
              <summary className="min-h-11 cursor-pointer py-2 text-sm text-forest underline underline-offset-4">Each entry</summary>
              <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10 bg-white text-sm">
                {o.losses.details.map((d, index) => (
                  <li key={index} className="px-3 py-2">
                    <span className="font-medium">
                      {formatQuantityWithUnit(d.quantity, d.unit)} {d.item}
                    </span>{" "}
                    {d.type === "LOST" ? "lost" : "damaged"}
                    {d.where && ` in ${d.where}`} · {formatDateTime(d.at)}
                    {d.note && <span className="block text-charcoal-light">{d.note}</span>}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </Section>

      <section aria-labelledby="export" className="mb-8 print:hidden">
        <h2 id="export" className="font-display text-lg text-forest">
          Download
        </h2>
        <p className="mb-3 text-sm text-charcoal-light">Spreadsheet files (CSV) you can open in Excel or Google Sheets.</p>
        <ul className="flex flex-wrap gap-2">
          {OVERVIEW_TABLES.map((table) => (
            <li key={table}>
              <a
                href={`/admin/inventory/overview/export?table=${table}`}
                download
                className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-11" })}
              >
                {OVERVIEW_TABLE_LABELS[table]}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
