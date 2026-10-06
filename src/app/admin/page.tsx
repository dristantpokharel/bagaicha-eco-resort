import { requirePageUser, ROLE_LABELS } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const user = await requirePageUser();

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="rounded-lg border border-forest/10 bg-white p-6">
        <p className="text-charcoal">
          Signed in as <span className="font-medium">{user.name}</span> ({user.email})
        </p>
        <p className="mt-1 text-sm text-charcoal-light">Role: {ROLE_LABELS[user.role]}</p>
        <p className="mt-4 text-sm text-charcoal-light">
          Arrivals, departures, pending requests and low-stock items will appear here in later phases.
        </p>
      </div>
    </>
  );
}
