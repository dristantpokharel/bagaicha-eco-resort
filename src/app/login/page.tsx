import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { getCurrentUser, safeCallbackUrl } from "@/lib/auth";
import { FormMessage } from "@/components/ui/form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; reason?: string }>;
}) {
  const { callbackUrl, reason } = await searchParams;
  const target = safeCallbackUrl(callbackUrl);

  // Checked against the DB, so a revoked session doesn't loop back to /admin.
  if (await getCurrentUser()) redirect(target);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-forest">{SITE.name}</p>
          <p className="mt-2 text-sm text-charcoal-light">Staff sign in</p>
        </div>
        <div className="space-y-4 rounded-lg border border-forest/10 bg-white p-6 shadow-subtle">
          {reason === "session-ended" && (
            <FormMessage type="error">Your session has ended. Please sign in again.</FormMessage>
          )}
          {reason === "password-changed" && (
            <FormMessage type="success">Password changed. Please sign in with your new password.</FormMessage>
          )}
          <LoginForm callbackUrl={target} />
        </div>
      </div>
    </main>
  );
}
