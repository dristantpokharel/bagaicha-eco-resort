import { isStaging } from "@/lib/site-env";

/** Thin strip on every public page of the staging site; renders nothing elsewhere. */
export function StagingBanner() {
  if (!isStaging) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 bg-forest-dark py-0.5 text-center font-label text-xs text-cream"
    >
      Test site — not live
    </div>
  );
}
