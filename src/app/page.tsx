import { SITE } from "@/config/site";

// DEV PLACEHOLDER — replaced by the public homepage in Phase 5. Must not ship.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-serif text-4xl text-forest">{SITE.name}</h1>
      <p className="text-charcoal-light">{SITE.tagline}</p>
      <p className="mt-6 rounded-sm border border-dashed border-forest px-3 py-1 text-sm text-forest">
        Dev placeholder — public site arrives in Phase 5
      </p>
    </main>
  );
}
