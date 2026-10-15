import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { GuideEditor } from "../guide-editor";
import { loadLibrary, toFormValues } from "../loaders";

export const metadata = { title: "Edit guide" };

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("content.manage");
  const guide = await db.guide.findUnique({ where: { id: (await params).id } });
  if (!guide) notFound();
  // Remount after each save so the form shows what the server stored (cleared placeholder flags, set date).
  return <GuideEditor key={guide.updatedAt.toISOString()} initial={toFormValues(guide)} library={await loadLibrary()} />;
}
