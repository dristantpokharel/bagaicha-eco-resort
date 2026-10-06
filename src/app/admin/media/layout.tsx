import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav } from "@/components/admin/sub-nav";

export default async function MediaLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission(ADMIN_SECTIONS.media.permission);
  return (
    <>
      <PageHeader title="Media" description="Upload photos, write alt text, and choose where they appear." />
      <SubNav
        label="Media sections"
        links={[
          { href: "/admin/media", label: "Library" },
          { href: "/admin/media/gallery", label: "Gallery" },
          { href: "/admin/media/homepage", label: "Homepage" },
        ]}
      />
      {children}
    </>
  );
}
