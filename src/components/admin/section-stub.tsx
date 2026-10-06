import { requirePagePermission, requirePageUser } from "@/lib/auth";
import { ADMIN_SECTIONS, type AdminSection, type AdminSectionKey } from "@/lib/admin-nav";
import { PageHeader } from "./page-header";

/** Guarded placeholder for admin sections that later phases will build. */
export async function SectionStub({ section }: { section: AdminSectionKey }) {
  const config: AdminSection = ADMIN_SECTIONS[section];
  if (config.permission) await requirePagePermission(config.permission);
  else await requirePageUser();

  return (
    <>
      <PageHeader title={config.label} />
      <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-6 text-sm text-charcoal-light">
        Not built yet{config.phase ? ` — coming in Phase ${config.phase}` : " — coming in a later phase"}.
      </p>
    </>
  );
}
