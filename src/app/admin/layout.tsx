import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { requirePageUser, ROLE_LABELS } from "@/lib/auth";
import { phoneNav, visibleNavGroups } from "@/lib/admin-nav";
import { Logo } from "@/components/brand/logo";
import { AdminSidebar, PhoneTabBar } from "@/components/admin/admin-nav";
import { AdminSearch } from "@/components/admin/admin-search";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · Admin · ${SITE.name}` },
  robots: { index: false, follow: false },
};

// Lets the bottom tab bar sit above the home indicator on notched phones (env(safe-area-inset-bottom)).
export const viewport: Viewport = { viewportFit: "cover" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const groups = visibleNavGroups(user.role);
  const { tabs, more } = phoneNav(user.role);

  return (
    <div className="admin-shell flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-forest/10 bg-white px-4 py-2 md:px-6 md:py-3">
        <Link
          href="/admin"
          aria-label={`${SITE.name}, admin home`}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
        >
          <Logo art="wordmark" className="h-9 w-auto md:h-12" />
        </Link>
        <div className="flex items-center gap-3">
          <AdminSearch />
          <Link
            href="/admin/profile"
            className="hidden rounded-sm text-right text-sm leading-tight focus-visible:outline-2 focus-visible:outline-forest md:block"
          >
            <span className="block font-medium text-charcoal underline-offset-2 hover:underline">{user.name}</span>
            <span className="block text-xs text-charcoal-light">{ROLE_LABELS[user.role]}</span>
          </Link>
          <form action={signOutAction} className="hidden md:block">
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <AdminSidebar groups={groups} />
        {/* Phones: room at the bottom so nothing sits behind the fixed tab bar. */}
        <main className="min-w-0 flex-1 px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-6">{children}</main>
      </div>
      <PhoneTabBar tabs={tabs} more={more} userName={user.name} roleLabel={ROLE_LABELS[user.role]} signOut={signOutAction} />
    </div>
  );
}
