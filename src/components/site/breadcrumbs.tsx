"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FOOTER_NAV } from "@/config/site-copy";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import { JsonLd } from "./json-ld";

export type Crumb = { name: string; path: string };

/** Visible trail plus BreadcrumbList data. The last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(trail)} />
      <nav aria-label="Breadcrumb" className="container-page pt-6 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {trail.map((c, i) => (
            <li key={c.path} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === trail.length - 1 ? (
                <span aria-current="page" className="text-ink">{c.name}</span>
              ) : (
                <Link href={c.path} className="underline-offset-4 hover:underline">{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

const EXTRA: Record<string, string> = { "/book": "Book", "/enquiry": "Enquiry" };

/**
 * BreadcrumbList data for every top-level public page, from the nav labels. Guide posts supply their
 * own trail (with the post title), so this renders nothing for paths below /guides/.
 */
export function RouteBreadcrumbData() {
  const pathname = usePathname();
  const name = EXTRA[pathname] ?? FOOTER_NAV.find((n) => n.href === pathname)?.label;
  if (pathname === "/" || !name) return null;
  return <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name, path: pathname }])} />;
}
