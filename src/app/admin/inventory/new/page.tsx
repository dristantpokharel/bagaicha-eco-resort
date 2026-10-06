import { requirePagePermission } from "@/lib/auth";
import { listCategories } from "@/lib/inventory/queries";
import { SUGGESTED_CATEGORIES } from "@/config/inventory";
import { PageHeader } from "@/components/admin/page-header";
import { ItemForm } from "../item-form";

export const metadata = { title: "New inventory item" };

export default async function NewItemPage() {
  await requirePagePermission("inventory.manageItems");
  const existing = await listCategories();
  const categories = [...new Set([...existing, ...SUGGESTED_CATEGORIES])].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader title="New item" description="After saving, stock changes are recorded as movements." />
      <div className="max-w-3xl rounded-lg border border-forest/10 bg-white p-6">
        <ItemForm categories={categories} />
      </div>
    </>
  );
}
