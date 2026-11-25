import Link from "next/link";
import { KRISHNASAAR, RELATED_LINKS } from "@/config/site-copy";

type Key = keyof typeof RELATED_LINKS;

/** "Plan your stay" links between the main pages. Krishnasaar is added only while that page is live. */
export function RelatedLinks({ keys, krishnasaar = false }: { keys: readonly Key[]; krishnasaar?: boolean }) {
  const links: { href: string; label: string }[] = keys.map((k) => RELATED_LINKS[k]);
  if (krishnasaar) links.push({ href: KRISHNASAAR.path, label: KRISHNASAAR.navLabel });
  return (
    <nav aria-label="Plan your stay" className="container-page py-8">
      <h2 className="text-label text-ink-heading">Plan your stay</h2>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-ink underline underline-offset-4 hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
