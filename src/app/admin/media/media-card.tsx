"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Textarea } from "@/components/ui/form";
import { MediaImage, type MediaImageData } from "@/components/media/media-image";
import { formatBytes } from "@/lib/media";
import type { ActionResult } from "@/lib/actions";
import { deleteMedia, setMediaPlaceholder, updateAltText } from "./actions";

export type LibraryItem = MediaImageData & {
  id: string;
  altNeedsReview: boolean;
  format: string | null;
  bytes: number | null;
  originalFilename: string | null;
  isPlaceholder: boolean;
  placeholderNote: string | null;
  usage: string[];
};

export function MediaCard({ item }: { item: LibraryItem }) {
  const [altResult, altAction, altPending] = useActionState<ActionResult | null, FormData>(updateAltText, null);
  const [flagResult, flagAction, flagPending] = useActionState<ActionResult | null, FormData>(setMediaPlaceholder, null);
  const [deleteResult, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(deleteMedia, null);
  const altError = altResult && !altResult.ok ? altResult.fieldErrors?.altText : undefined;
  const inUse = item.usage.length > 0;
  const name = item.originalFilename ?? "Untitled image";

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-forest/10 bg-white">
      <div className="relative aspect-[4/3] bg-forest/5">
        {/* The label below names the image, so the thumbnail itself is decorative here. */}
        <MediaImage
          media={item}
          alt=""
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {item.isPlaceholder && (
            <span className="rounded-sm bg-error px-2 py-0.5 text-xs font-medium text-white">Placeholder / rights unconfirmed</span>
          )}
          {item.altNeedsReview && (
            <span className="rounded-sm bg-warning px-2 py-0.5 text-xs font-medium text-white">Alt text needs review</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 text-sm">
        <div>
          <p className="truncate font-medium text-charcoal" title={name}>
            {name}
          </p>
          <p className="text-xs text-charcoal-light">
            {item.width}×{item.height}
            {item.format ? ` · ${item.format.toUpperCase()}` : ""}
            {item.bytes ? ` · ${formatBytes(item.bytes)}` : ""}
          </p>
        </div>

        <form action={altAction} className="space-y-2" noValidate>
          <input type="hidden" name="mediaId" value={item.id} />
          <label htmlFor={`alt-${item.id}`} className="block text-xs font-medium text-charcoal">
            Alt text{item.altNeedsReview ? " (draft, please check)" : ""}
          </label>
          <Textarea
            id={`alt-${item.id}`}
            name="altText"
            rows={2}
            maxLength={300}
            defaultValue={item.altText}
            placeholder="Describe what the photo shows"
            aria-invalid={altError ? true : undefined}
            aria-describedby={altError ? `alt-${item.id}-error` : undefined}
          />
          {altError && (
            <p id={`alt-${item.id}-error`} className="text-xs text-error">
              {altError}
            </p>
          )}
          <Button type="submit" variant="secondary" size="sm" disabled={altPending}>
            {altPending ? "Saving…" : item.altNeedsReview ? "Save and mark reviewed" : "Save alt text"}
          </Button>
          {!altError && <ActionMessage result={altResult} />}
        </form>

        <form action={flagAction} className="space-y-2 border-t border-forest/10 pt-3" noValidate>
          <input type="hidden" name="mediaId" value={item.id} />
          {item.isPlaceholder ? (
            <>
              <p className="text-xs text-charcoal-light">{item.placeholderNote ?? "Placeholder / rights unconfirmed"}. Hidden on the live site.</p>
              <input type="hidden" name="flag" value="clear" />
              <label className="flex items-start gap-2 text-xs text-charcoal">
                <input type="checkbox" required name="confirm" className="mt-0.5 size-4 accent-forest" />
                <span>
                  <strong>Rights confirmed / final.</strong> This is a real photo we may publish.
                </span>
              </label>
              <Button type="submit" variant="secondary" size="sm" disabled={flagPending}>
                {flagPending ? "Saving…" : "Clear placeholder flag"}
              </Button>
            </>
          ) : (
            <>
              <input type="hidden" name="flag" value="set" />
              <Button type="submit" variant="ghost" size="sm" disabled={flagPending}>
                {flagPending ? "Saving…" : "Mark as placeholder"}
              </Button>
            </>
          )}
          <ActionMessage result={flagResult} />
        </form>

        <div className="mt-auto space-y-2 border-t border-forest/10 pt-3">
          {inUse ? (
            <ul className="flex flex-wrap gap-1" aria-label="Used in">
              {item.usage.map((use) => (
                <li key={use} className="rounded-sm bg-forest/5 px-2 py-0.5 text-xs text-forest">
                  {use}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-charcoal-light">Not used anywhere yet.</p>
          )}
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!window.confirm(`Delete “${name}” from the library and Cloudinary? This can't be undone.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="mediaId" value={item.id} />
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={inUse || deletePending}
              aria-describedby={inUse ? `in-use-${item.id}` : undefined}
            >
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
            {inUse && (
              <p id={`in-use-${item.id}`} className="mt-1 text-xs text-charcoal-light">
                Remove it from the places above to delete it.
              </p>
            )}
          </form>
          <ActionMessage result={deleteResult} />
        </div>
      </div>
    </li>
  );
}
