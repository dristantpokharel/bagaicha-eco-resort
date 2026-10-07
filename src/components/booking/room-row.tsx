"use client";

import { RoomGuestsField } from "@/components/booking/room-guests-field";
import { describeCapacity } from "@/lib/booking/capacity";
import { typeOption, type BuilderRoom, type BuilderType, type StayFree } from "@/lib/booking/room-builder";
import { formatNpr } from "@/lib/money";

type Props = {
  index: number;
  rooms: BuilderRoom[];
  types: BuilderType[];
  free: StayFree;
  childUnderAge: number;
  onChange: (room: BuilderRoom) => void;
  /** Rooms 2 and up can be removed. */
  onRemove?: () => void;
};

/** One room of the stay: a button per room type (name, price, rooms left) and the room's guests. */
export function RoomRow({ index, rooms, types, free, childUnderAge, onChange, onRemove }: Props) {
  const room = rooms[index];
  const chosen = types.find((t) => t.slug === room.slug);
  const number = index + 1;

  return (
    <li className="border border-forest/20 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`room-${number}-heading`} className="font-display text-xl font-semibold italic text-ink-heading">
          Room {number}
        </h3>
        {onRemove && (
          <button type="button" onClick={onRemove} className="min-h-11 px-1 text-sm text-forest underline underline-offset-4" aria-label={`Remove room ${number}`}>
            Remove
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-charcoal">Room type</legend>
          {/* Wraps on desktop; on phones one scrolling line, so any number of types fits. */}
          <div className="-mx-1 flex gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible">
            {types.map((type) => {
              const option = typeOption(rooms, index, type, free);
              const status = option.reason ?? (option.left !== null ? `${option.left} left` : null);
              return (
                <label key={type.slug} className={`relative shrink-0 ${option.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="radio"
                    name={`room-${number}-type`}
                    value={type.slug}
                    checked={room.slug === type.slug}
                    disabled={option.disabled}
                    onChange={() => onChange({ ...room, slug: type.slug })}
                    className="peer sr-only"
                  />
                  <span
                    className={
                      "flex min-h-16 min-w-36 flex-col justify-center gap-0.5 border px-4 py-2 font-sans text-sm font-normal normal-case tracking-normal transition-colors " +
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest " +
                      (option.disabled
                        ? "border-ink/20 bg-sage/40 text-ink-muted"
                        : "border-forest/40 bg-white text-forest hover:bg-sage peer-checked:border-forest peer-checked:bg-forest peer-checked:text-cream")
                    }
                  >
                    <span className="font-medium">{type.name}</span>
                    <span>{formatNpr(type.basePriceNpr)} / night</span>
                    {status && <span className={`text-xs ${option.disabled ? "" : "opacity-80"}`}>{status}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 min-h-5 text-sm text-ink-muted">{chosen ? describeCapacity(chosen) : ""}</p>
        </fieldset>

        <RoomGuestsField
          roomNumber={number}
          party={{ adults: room.adults, children: room.children }}
          onChange={(party) => onChange({ ...room, ...party })}
          caps={chosen ? [chosen] : types}
          typeName={chosen?.name}
          childUnderAge={childUnderAge}
        />
      </div>
    </li>
  );
}
