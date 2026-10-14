import { can, requirePageUser } from "@/lib/auth";
import { SubNav, type NavLink } from "@/components/admin/sub-nav";

/** Tabs across the inventory pages; each shows only if the role may use it. */
export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const links: (NavLink & { show: boolean })[] = [
    { href: "/admin/inventory/overview", label: "Overview", show: can(user.role, "inventory.overview") },
    { href: "/admin/inventory", label: "Items", show: can(user.role, "inventory.recordMovements") },
    { href: "/admin/inventory/record", label: "Record stock", show: can(user.role, "inventory.recordMovements") },
    { href: "/admin/inventory/move", label: "Move", show: can(user.role, "inventory.recordMovements") },
    { href: "/admin/housekeeping", label: "Housekeeping", show: can(user.role, "housekeeping.work") },
  ];
  return (
    <>
      <SubNav label="Inventory" links={links.filter((l) => l.show).map(({ href, label }) => ({ href, label }))} />
      {children}
    </>
  );
}
