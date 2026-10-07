"use client";

import { RoomGuestsField } from "@/components/booking/room-guests-field";
import { calculationLines, quoteRooms, typeOption, type BuilderRoom, type BuilderType, type StayFree } from "@/lib/booking/room-builder";
import { formatNpr } from "@/lib/money";

type Props = {
  index: number;
  rooms: BuilderRoom[];
  types: BuilderType[];
  free: StayFree;
  /** Nights of the chosen dates; 0 until both are set. */
  nights: number;
  childUnderAge: number;
  onChange: (room: BuilderRoom) => void;
  /** Rooms 2 and up can be removed. */
  onRemove?: () => void;
};

/** One room of the stay, on one line on desktop: label, a button per room type, guests. Stacked on phones. */
export function RoomRow({ index, rooms, types, free, nights, childUnderAge, onChange, onRemove }: Props) {
  const room = rooms[index];
  const chosen = types.find((t) => t.slug === room.slug);
  const number = index + 1;
  const quote = chosen && nights > 0 ? quoteRooms([room], new Map([[chosen.slug, chosen]]), nights).lines[0]?.quote : undefined;

  return (
    <li className="py-5 first:pt-4">
      <div className="grid gap-3 lg:flex lg:items-start lg:gap-4">
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:justify-start lg:gap-0 lg:w-[4.5rem] lg:shrink-0 lg:pt-4">
          <h3 className="font-display text-xl font-semibold italic text-ink-heading">Room {number}</h3>
          {onRemove && (
            <button type="button" onClick={onRemove} className="min-h-11 text-sm text-forest underline underline-offset-4 lg:min-h-8" aria-label={`Remove room ${number}`}>
              Remove
            </button>
          )}
        </div>

        <fieldset className="lg:min-w-0">
          <legend className="sr-only">Room type for room {number}</legend>
          {/* Wraps on desktop; on phones one scrolling line, so any number of types fits. */}
          <div className="-m-1 flex gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible">
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
                      "flex min-h-19 min-w-40 flex-col justify-center gap-0.5 border px-4 py-2 font-sans text-sm font-normal normal-case tracking-normal transition-colors " +
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest " +
                      (option.disabled
                        ? "border-ink/20 bg-sage/40 text-ink-muted"
                        : "border-forest/40 bg-white text-forest hover:bg-sage peer-checked:border-forest peer-checked:bg-forest peer-checked:text-cream")
                    }
                  >
                    <span className="font-medium">{type.name}</span>
                    <span>{formatNpr(type.basePriceNpr)} / night</span>
                    {status && <span className="text-xs opacity-80">{status}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-2 min-h-5 text-sm text-ink-muted">
            {chosen &&
              (quote ? calculationLines(quote, formatNpr) : [`${formatNpr(chosen.basePriceNpr)} / night`]).map((line) => (
                <p key={line} className={line.startsWith("Room total") ? "text-ink" : undefined}>
                  {line}
                </p>
              ))}
          </div>
        </fieldset>

        <div className="lg:w-56 lg:shrink-0">
          <RoomGuestsField
            roomNumber={number}
            party={{ adults: room.adults, children: room.children }}
            onChange={(party) => onChange({ ...room, ...party })}
            caps={chosen ? [chosen] : types}
            typeName={chosen?.name}
            childUnderAge={childUnderAge}
          />
        </div>
      </div>
    </li>
  );
}
