import { requirePageUser, ROLE_LABELS } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { NameForm, PasswordForm } from "./profile-forms";

export const metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await requirePageUser();
  return (
    <>
      <PageHeader title="Your profile" description={`${user.email} · ${ROLE_LABELS[user.role]}`} />
      <div className="space-y-8">
        <section aria-labelledby="name-heading" className="rounded-lg border border-forest/10 bg-white p-6">
          <h2 id="name-heading" className="mb-4 font-display text-lg text-forest">
            Name
          </h2>
          <NameForm key={user.name} name={user.name} />
        </section>
        <section aria-labelledby="password-heading" className="rounded-lg border border-forest/10 bg-white p-6">
          <h2 id="password-heading" className="mb-4 font-display text-lg text-forest">
            Password
          </h2>
          <PasswordForm />
        </section>
        <p className="text-sm text-charcoal-light">To change your email address or role, ask a Superuser.</p>
      </div>
    </>
  );
}
