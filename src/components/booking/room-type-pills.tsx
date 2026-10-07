"use client";

type RoomTypeOption = { slug: string; name: string; maxGuests: number };

/**
 * Room type as a radio group styled as pills: "Any room" then each type. Native radios, so arrow keys,
 * the form value (`room`, empty for any room) and screen-reader grouping come for free.
 */
export function RoomTypePills({
  roomTypes,
  value,
  onChange,
  hint,
}: {
  roomTypes: RoomTypeOption[];
  value: string;
  onChange: (slug: string) => void;
  hint?: string;
}) {
  const options = [{ slug: "", label: "Any room" }, ...roomTypes.map((r) => ({ slug: r.slug, label: `${r.name} · up to ${r.maxGuests}` }))];
  return (
    <fieldset aria-describedby={hint ? "room-hint" : undefined}>
      <legend className="mb-1.5 block text-sm font-medium text-charcoal">Room type</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.slug || "any"} className="relative cursor-pointer">
            <input
              type="radio"
              name="room"
              value={o.slug}
              checked={value === o.slug}
              onChange={() => onChange(o.slug)}
              className="peer sr-only"
            />
            <span
              className={
                "flex min-h-11 items-center border border-forest/40 bg-white px-4 font-sans text-sm font-normal normal-case tracking-normal text-forest transition-colors " +
                "hover:bg-sage peer-checked:border-forest peer-checked:bg-forest peer-checked:text-cream " +
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest"
              }
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && (
        <p id="room-hint" className="mt-1.5 text-xs text-charcoal-light">
          {hint}
        </p>
      )}
    </fieldset>
  );
}
