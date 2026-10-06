"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import type { ActionResult } from "@/lib/actions";
import {
  addPlacements,
  removePlacement,
  reorderPlacements,
  type PlacementTarget,
} from "@/app/admin/media/placement-actions";
import { MediaImage, type MediaImageData } from "./media-image";

export type PickerMedia = MediaImageData & { id: string; altNeedsReview: boolean; originalFilename: string | null };
export type Placement = { placementId: string; media: PickerMedia };

function displayName(media: PickerMedia) {
  return media.altText || media.originalFilename || "Untitled image";
}

/**
 * Ordered images for one target (room type, gallery category or homepage slot).
 * Drag to reorder (mouse, touch or keyboard), or use the arrow buttons.
 * Remount with a new `key` when the server data changes.
 */
export function PlacementManager({
  target,
  placements,
  library,
  title,
  description,
}: {
  target: PlacementTarget;
  placements: Placement[];
  library: PickerMedia[];
  title: string;
  description?: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(placements);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = `placement-${target.kind}-${"slot" in target ? target.slot : "category" in target ? target.category : "activityId" in target ? target.activityId : target.roomTypeId}`;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function run(action: () => Promise<ActionResult>, rollback?: Placement[]) {
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (!outcome.ok && rollback) setOrder(rollback);
      if (outcome.ok) router.refresh();
    });
  }

  function saveOrder(next: Placement[]) {
    const previous = order;
    setOrder(next);
    run(
      () =>
        reorderPlacements(
          target,
          next.map((p) => p.placementId),
        ),
      previous,
    );
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= order.length) return;
    saveOrder(arrayMove(order, index, to));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((p) => p.placementId === active.id);
    const to = order.findIndex((p) => p.placementId === over.id);
    saveOrder(arrayMove(order, from, to));
  }

  function remove(placement: Placement) {
    if (!window.confirm(`Remove “${displayName(placement.media)}” from ${title}? It stays in the media library.`))
      return;
    const previous = order;
    setOrder(order.filter((p) => p.placementId !== placement.placementId));
    run(() => removePlacement(target, placement.placementId), previous);
  }

  function addSelected(mediaIds: string[]) {
    dialogRef.current?.close();
    if (mediaIds.length) run(() => addPlacements(target, mediaIds));
  }

  const placedIds = new Set(order.map((p) => p.media.id));

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-forest/10 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="font-display text-lg text-forest">
            {title} <span className="text-sm text-charcoal-light">({order.length})</span>
          </h3>
          {description && <p className="text-xs text-charcoal-light">{description}</p>}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => dialogRef.current?.showModal()}
          disabled={pending || library.length === 0}
        >
          Add images
        </Button>
      </div>

      {order.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/25 px-3 py-6 text-center text-sm text-charcoal-light">
          {library.length === 0 ? "Upload images in the Library first." : "No images yet."}
        </p>
      ) : (
        <DndContext id={headingId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((p) => p.placementId)} strategy={rectSortingStrategy}>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy={pending}>
              {order.map((placement, index) => (
                <SortableTile
                  key={placement.placementId}
                  placement={placement}
                  index={index}
                  count={order.length}
                  disabled={pending}
                  onMove={(delta) => move(index, delta)}
                  onRemove={() => remove(placement)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div className="mt-3">
        <ActionMessage result={result} />
      </div>

      <MediaPicker
        ref={dialogRef}
        title={`Add images to ${title}`}
        library={library}
        placedIds={placedIds}
        onAdd={addSelected}
      />
    </section>
  );
}

function SortableTile({
  placement,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  placement: Placement;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: placement.placementId,
    disabled,
  });
  const name = displayName(placement.media);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`overflow-hidden rounded-md border bg-white ${isDragging ? "z-10 border-forest shadow-elevated" : "border-forest/10"}`}
    >
      <div className="relative aspect-[4/3] bg-forest/5">
        <MediaImage media={placement.media} alt="" sizes="200px" className="object-cover" />
        <span className="absolute top-1 left-1 rounded-sm bg-forest px-1.5 text-xs text-cream">{index + 1}</span>
        {placement.media.altNeedsReview && (
          <span className="absolute right-1 bottom-1 rounded-sm bg-warning px-1.5 text-[0.6875rem] text-white">
            Alt needs review
          </span>
        )}
      </div>
      <p className="truncate px-2 pt-1.5 text-xs text-charcoal" title={name}>
        {name}
      </p>
      <div className="flex items-center justify-between gap-1 p-1.5">
        <button
          type="button"
          className="inline-flex size-8 cursor-grab items-center justify-center rounded-sm text-charcoal-light hover:bg-forest/5 focus-visible:outline-2 focus-visible:outline-forest active:cursor-grabbing"
          aria-label={`Drag to reorder ${name}. Position ${index + 1} of ${count}.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-0.5">
          <IconButton label={`Move ${name} earlier`} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
            <ArrowLeft size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label={`Move ${name} later`} disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
            <ArrowRight size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label={`Remove ${name}`} disabled={disabled} onClick={onRemove}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-sm text-charcoal hover:bg-forest/5 focus-visible:outline-2 focus-visible:outline-forest disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Modal list of library images with checkboxes. Images already placed are shown but can't be picked. */
function MediaPicker({
  ref,
  title,
  library,
  placedIds,
  onAdd,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  title: string;
  library: PickerMedia[];
  placedIds: Set<string>;
  onAdd: (mediaIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const titleId = `${title.replace(/\W+/g, "-").toLowerCase()}-title`;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => setSelected([])}
      className="m-auto max-h-[85vh] w-[min(56rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-forest/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-forest/10 px-5 py-3">
          <h2 id={titleId} className="font-display text-lg text-forest">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-sm hover:bg-forest/5 focus-visible:outline-2 focus-visible:outline-forest"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ul className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4">
          {library.map((media) => {
            const placed = placedIds.has(media.id);
            const checked = selected.includes(media.id);
            const name = displayName(media);
            return (
              <li key={media.id}>
                <label
                  className={`block overflow-hidden rounded-md border-2 ${
                    checked ? "border-forest" : "border-transparent"
                  } ${placed ? "cursor-not-allowed opacity-50" : "cursor-pointer"} focus-within:outline-2 focus-within:outline-forest`}
                >
                  <span className="relative block aspect-[4/3] bg-forest/5">
                    <MediaImage media={media} alt="" sizes="200px" className="object-cover" />
                  </span>
                  <span className="flex items-start gap-2 p-2 text-xs text-charcoal">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={placed}
                      onChange={() => toggle(media.id)}
                      className="mt-0.5 accent-forest"
                    />
                    <span className="min-w-0">
                      <span className="line-clamp-2">{name}</span>
                      {placed && <span className="block text-charcoal-light">Already added</span>}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-end gap-2 border-t border-forest/10 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button size="sm" disabled={selected.length === 0} onClick={() => onAdd(selected)}>
            Add {selected.length || ""} selected
          </Button>
        </div>
      </div>
    </dialog>
  );
}
