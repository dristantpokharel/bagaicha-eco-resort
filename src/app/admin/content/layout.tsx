import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav } from "@/components/admin/sub-nav";

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission(ADMIN_SECTIONS.content.permission);
  return (
    <>
      <PageHeader title="Content" description="Edit what the public website says. Changes appear on the site as soon as you save." />
      <SubNav
        label="Content sections"
        links={[
          { href: "/admin/content", label: "Business info" },
          { href: "/admin/content/activities", label: "Activities" },
          { href: "/admin/content/dining", label: "Dining" },
          { href: "/admin/content/events", label: "Events" },
          { href: "/admin/content/faqs", label: "FAQs" },
          { href: "/admin/content/policies", label: "Policies" },
          { href: "/admin/content/nearby", label: "Nearby" },
        ]}
      />
      {children}
    </>
  );
}
