import type { RoomStatus } from "@/generated/prisma/enums";
import { ROOM_STATUS_LABELS } from "@/lib/housekeeping/status";

const BADGE: Record<RoomStatus, string> = {
  READY: "border-success/40 bg-success/10 text-success",
  DIRTY: "border-warning/40 bg-warning/10 text-warning",
  OCCUPIED: "border-forest/30 bg-forest/10 text-forest",
  OUT_OF_ORDER: "border-error/30 bg-error/5 text-error",
};

const DOT: Record<RoomStatus, string> = {
  READY: "bg-success",
  DIRTY: "bg-warning",
  OCCUPIED: "bg-forest",
  OUT_OF_ORDER: "bg-error",
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE[status]}`}>
      {ROOM_STATUS_LABELS[status]}
    </span>
  );
}

/** A small coloured dot with the status as its accessible name (tape chart rows). */
export function RoomStatusDot({ status }: { status: RoomStatus }) {
  return (
    <span role="img" aria-label={ROOM_STATUS_LABELS[status]} title={ROOM_STATUS_LABELS[status]} className={`inline-block size-2.5 shrink-0 rounded-full ${DOT[status]}`} />
  );
}
