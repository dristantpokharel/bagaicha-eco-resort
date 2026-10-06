import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <>
      <PageHeader title="Access denied" description="Your role doesn't have access to that page." />
      <Link href="/admin" className={buttonClasses({ variant: "secondary" })}>
        Back to dashboard
      </Link>
    </>
  );
}
