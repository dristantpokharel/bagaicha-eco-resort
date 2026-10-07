import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { can, requirePageUser, ROLE_LABELS } from "@/lib/auth";
import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin-nav";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · Admin · ${SITE.name}` },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const links = Object.values<AdminSection>(ADMIN_SECTIONS)
    .filter((section) => !section.permission || can(user.role, section.permission))
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="admin-shell flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-forest/10 bg-white px-4 py-3 md:px-6">
        <Link
          href="/admin"
          aria-label={`${SITE.name}, admin home`}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
        >
          <Logo art="wordmark" className="h-10 w-auto md:h-12" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/profile"
            className="rounded-sm text-right text-sm leading-tight focus-visible:outline-2 focus-visible:outline-forest"
          >
            <span className="block font-medium text-charcoal underline-offset-2 hover:underline">{user.name}</span>
            <span className="block text-xs text-charcoal-light">{ROLE_LABELS[user.role]}</span>
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-forest/10 bg-white p-3 md:w-56 md:shrink-0 md:border-r md:border-b-0">
          <AdminNav links={links} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
