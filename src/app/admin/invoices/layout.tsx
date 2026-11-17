import { requirePagePermission } from "@/lib/auth";

export default async function InvoicesLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("invoices.view");
  return children;
}
