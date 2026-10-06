import { isLowStock, isOutOfStock, type Quantity } from "@/lib/inventory/stock";

type StockItem = { isActive: boolean; quantity: Quantity; lowStockThreshold: Quantity };

/** "Low stock" / "Out of stock" pill, or an "Archived" pill; renders nothing for healthy stock. */
export function StockBadge({ item }: { item: StockItem }) {
  if (!item.isActive) return <Pill className="border-charcoal/20 bg-charcoal/5 text-charcoal-light">Archived</Pill>;
  if (isOutOfStock(item)) return <Pill className="border-error/30 bg-error/5 text-error">Out of stock</Pill>;
  if (isLowStock(item)) return <Pill className="border-warning/40 bg-warning/10 text-warning">Low stock</Pill>;
  return null;
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}
