import { db } from "@/lib/db";
import { PlacementManager } from "@/components/media/placement-manager";
import { loadPickerLibrary, placementKey, toPlacements, pickerMediaSelect } from "@/lib/media-queries";
import { ContentForm, type Option } from "../content-form";
import { loadMediaOptions, toContentRow } from "../rows";

export const metadata = { title: "Krishnasaar page" };

export default async function KrishnasaarAdminPage() {
  const [page, faqs, destinations, mediaOptions, library, gallery] = await Promise.all([
    db.krishnasaarPage.findUnique({ where: { id: 1 } }),
    db.krishnasaarFaq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.nearbyDestination.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    loadMediaOptions(),
    loadPickerLibrary(),
    db.krishnasaarMedia.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, media: { select: pickerMediaSelect } } }),
  ]);
  const destinationOptions: Option[] = destinations.map((d) => ({ value: d.id, label: d.name }));
  const placements = toPlacements(gallery);
  const flagged = (page?.placeholderFields.length ?? 0) + faqs.filter((f) => f.placeholderFields.length > 0).length;

  return (
    <div className="max-w-3xl space-y-10">
      <p className="text-sm text-charcoal-light">
        The /krishnasaar page. Every fact starts marked <strong>verify</strong>. In production the page stays hidden until the
        title, intro and “What it is” are reviewed, and any other section stays hidden until you edit it or tick “I have reviewed
        this”. The full checklist is in <code>docs/krishnasaar-verify.md</code>.
        {flagged > 0 && <span className="ml-1 font-medium text-warning">{flagged} item{flagged === 1 ? "" : "s"} still to verify.</span>}
      </p>

      {page ? (
        <section aria-labelledby="k-page" className="rounded-md border border-forest/15 bg-white p-5">
          <h2 id="k-page" className="mb-3 font-display text-lg text-forest">Page text</h2>
          <ContentForm collection="krishnasaar" row={toContentRow("krishnasaar", page)} mediaOptions={mediaOptions} destinationOptions={destinationOptions} />
        </section>
      ) : (
        <p className="text-sm text-charcoal-light">
          No Krishnasaar page yet. Run <code>npm run seed:krishnasaar</code> after the migration has been applied.
        </p>
      )}

      <section aria-labelledby="k-gallery" className="rounded-md border border-forest/15 bg-white p-5">
        <h2 id="k-gallery" className="sr-only">Gallery</h2>
        <PlacementManager
          key={placementKey(placements)}
          target={{ kind: "krishnasaar" }}
          title="Photo gallery"
          description="Shown in this order on the page. Upload new photos in Media → Library."
          placements={placements}
          library={library}
        />
      </section>

      <section aria-labelledby="k-faqs">
        <h2 id="k-faqs" className="mb-3 font-display text-lg text-forest">Questions and answers</h2>
        <ul className="space-y-2">
          {faqs.map((f) => {
            const row = toContentRow("krishnasaarFaqs", f);
            return (
              <li key={f.id} className="rounded-md border border-forest/15 bg-white">
                <details>
                  <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 focus-visible:outline-2 focus-visible:outline-forest">
                    <span className="font-medium text-charcoal">{f.question}</span>
                    {row.placeholderFields.length > 0 && (
                      <span className="rounded-sm border border-warning/40 px-1.5 py-0.5 text-xs text-warning">verify</span>
                    )}
                    {!f.isActive && <span className="rounded-sm border border-charcoal/25 px-1.5 py-0.5 text-xs text-charcoal-light">Hidden</span>}
                  </summary>
                  <div className="border-t border-forest/10 p-4">
                    <ContentForm collection="krishnasaarFaqs" row={row} />
                  </div>
                </details>
              </li>
            );
          })}
          {faqs.length === 0 && <li className="text-sm text-charcoal-light">Nothing here yet.</li>}
        </ul>
        <details className="mt-3 rounded-md border border-dashed border-forest/30 bg-white">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 py-2 font-medium text-forest focus-visible:outline-2 focus-visible:outline-forest">
            Add question
          </summary>
          <div className="border-t border-forest/10 p-4">
            <ContentForm collection="krishnasaarFaqs" />
          </div>
        </details>
      </section>
    </div>
  );
}
