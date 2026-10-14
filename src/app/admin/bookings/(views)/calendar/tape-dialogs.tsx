"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { formatShortDate, parseDateOnly } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/labels";
import { buildProposal, nightsOf, type Caps, type Proposal, type TapeBar, type TapeData, type TapeRoom } from "@/lib/booking/tape";
import { formatNpr } from "@/lib/money";
import { createRoomBlock } from "../blocks/actions";
import type { TapeResult } from "../../tape-actions";

const range = (checkIn: string, checkOut: string) =>
  `${formatShortDate(parseDateOnly(checkIn)!)} to ${formatShortDate(parseDateOnly(checkOut)!)} (${nightsOf(checkIn, checkOut)} night${nightsOf(checkIn, checkOut) === 1 ? "" : "s"})`;

export const roomNameIn = (data: TapeData, id: string | null) =>
  id ? (data.types.flatMap((t) => t.rooms).find((r) => r.id === id)?.name ?? "?") : "Unassigned";

const TITLES = { move: "Confirm change", assign: "Assign and confirm", block: "Confirm block change" } as const;

/** The summary of a drop or form change, with the price impact, the email choice and the server's refusal if any. */
export function ProposalDialog({
  proposal,
  data,
  run,
  onClose,
}: {
  proposal: Proposal | null;
  data: TapeData;
  /** Runs the change; resolves to its result. On success the owner closes this dialog. */
  run: (proposal: Proposal, notify: boolean) => Promise<TapeResult>;
  onClose: () => void;
}) {
  return (
    <Sheet open={proposal !== null} onClose={onClose} label="Confirm change" placement="dialog">
      {proposal && <ProposalBody key={`${proposal.bar.id}-${proposal.to.roomId}-${proposal.to.checkIn}-${proposal.to.checkOut}`} proposal={proposal} data={data} run={run} onClose={onClose} />}
    </Sheet>
  );
}

function ProposalBody({ proposal, data, run, onClose }: { proposal: Proposal; data: TapeData; run: (p: Proposal, notify: boolean) => Promise<TapeResult>; onClose: () => void }) {
  const { bar, to } = proposal;
  const [notify, setNotify] = useState(proposal.defaultNotify);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isBlock = proposal.op === "block";
  const reservation = bar.reservationId ? data.reservations[bar.reservationId] : undefined;
  const delta = proposal.price ? proposal.price.after - proposal.price.before : 0;

  const confirm = () =>
    start(async () => {
      setError(null);
      const result = await run(proposal, notify);
      if (!result.ok) setError(result.error);
    });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <h2 className="font-display text-lg text-forest">{TITLES[proposal.op]}</h2>
      <p className="mt-1 text-sm text-charcoal-light">
        {isBlock ? `Block: ${bar.title}` : `${bar.reference} · ${bar.title}`}
      </p>

      <dl className="mt-3 space-y-2 text-sm">
        {proposal.roomChanged && (
          <div>
            <dt className="text-xs font-medium tracking-wide text-charcoal-light uppercase">Room</dt>
            <dd>
              {roomNameIn(data, bar.roomId)} → <strong>{roomNameIn(data, to.roomId)}</strong>
            </dd>
          </div>
        )}
        {proposal.datesChanged && (
          <div>
            <dt className="text-xs font-medium tracking-wide text-charcoal-light uppercase">Dates</dt>
            <dd>
              <span className="text-charcoal-light">{range(bar.checkIn, bar.checkOut)}</span>
              <br />now <strong>{range(to.checkIn, to.checkOut)}</strong>
            </dd>
          </div>
        )}
        {!isBlock && proposal.price && (
          <div>
            <dt className="text-xs font-medium tracking-wide text-charcoal-light uppercase">Price</dt>
            <dd>
              {formatNpr(proposal.price.before)} → <strong>{formatNpr(proposal.price.after)}</strong>{" "}
              <span className={delta > 0 ? "text-warning" : "text-charcoal-light"}>
                {delta === 0 ? "(no change)" : `(${delta > 0 ? "+" : "−"}${formatNpr(Math.abs(delta))})`}
              </span>
            </dd>
          </div>
        )}
        {!isBlock && !proposal.price && proposal.op === "move" && (
          <div>
            <dt className="text-xs font-medium tracking-wide text-charcoal-light uppercase">Price</dt>
            <dd>Unchanged: each room keeps its own rates.</dd>
          </div>
        )}
      </dl>

      {proposal.datesChanged && proposal.rooms > 1 && (
        <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          This moves all {proposal.rooms} rooms of {bar.reference}.
        </p>
      )}
      {proposal.op === "assign" && (
        <p className="mt-3 text-sm text-charcoal-light">
          The room is confirmed straight away. The guest gets the usual confirmation email once every room of the booking has been decided. This can&apos;t be undone from here.
        </p>
      )}

      {proposal.op === "move" && (
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={notify && proposal.guestHasEmail}
            disabled={!proposal.guestHasEmail}
            onChange={(e) => setNotify(e.target.checked)}
            className="size-5 accent-forest"
          />
          <span>
            Email the guest the updated details
            {!proposal.guestHasEmail && <span className="block text-xs text-charcoal-light">{reservation?.guestName ?? "The guest"} has no email address.</span>}
          </span>
        </label>
      )}

      {error && (
        <div className="mt-3">
          <FormMessage type="error">{error}</FormMessage>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={confirm} disabled={pending} className="min-h-11 flex-1">
          {pending ? "Saving…" : proposal.op === "assign" ? "Assign & confirm" : "Confirm"}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending} className="min-h-11 flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Tap a bar: its details, and the non-drag way to move it or change its dates. */
export function BarPanel({
  bar,
  data,
  caps,
  canBlock,
  onClose,
  onPropose,
}: {
  bar: TapeBar | null;
  data: TapeData;
  caps: Caps | null;
  canBlock: boolean;
  onClose: () => void;
  onPropose: (proposal: Proposal) => void;
}) {
  return (
    <Sheet open={bar !== null} onClose={onClose} label="Booking details" placement="dialog">
      {bar && caps && <PanelBody key={bar.id} bar={bar} data={data} caps={caps} canBlock={canBlock} onClose={onClose} onPropose={onPropose} />}
    </Sheet>
  );
}

function PanelBody({ bar, data, caps, canBlock, onClose, onPropose }: { bar: TapeBar; data: TapeData; caps: Caps; canBlock: boolean; onClose: () => void; onPropose: (p: Proposal) => void }) {
  const isBlock = bar.kind === "block";
  const [roomId, setRoomId] = useState(bar.roomId ?? "");
  const [checkIn, setCheckIn] = useState(bar.checkIn);
  const [checkOut, setCheckOut] = useState(bar.checkOut);
  const [error, setError] = useState<string | null>(null);

  const rooms: TapeRoom[] = isBlock
    ? data.types.flatMap((t) => t.rooms).filter((r) => r.isActive)
    : (data.types.find((t) => t.id === bar.roomTypeId)?.rooms ?? []).filter((r) => r.isActive);
  const editable = caps.drag && (caps.room || caps.start || caps.end);

  const review = (e: React.FormEvent) => {
    e.preventDefault();
    const target = rooms.find((r) => r.id === roomId);
    const result = buildProposal(
      bar,
      { roomId: roomId || null, typeId: isBlock ? null : (target?.typeId ?? bar.roomTypeId), checkIn, checkOut },
      data,
      { canBlock },
    );
    if (!result.ok) return setError(result.noop ? "Change a room or a date first." : result.reason);
    setError(null);
    onPropose(result.proposal);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-forest">{isBlock ? `Blocked: ${bar.title}` : bar.title}</h2>
          <p className="text-sm text-charcoal-light">
            {isBlock ? "Room block" : `${bar.reference} · ${BOOKING_STATUS_LABELS[bar.status!]}`} · {roomNameIn(data, bar.roomId)}
          </p>
          <p className="text-sm text-charcoal-light">{range(bar.checkIn, bar.checkOut)}</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-md px-3 text-sm text-forest hover:bg-forest/5">
          Close
        </button>
      </div>

      {!isBlock && (
        <p className="mt-2 text-sm">
          <Link href={`/admin/bookings/${bar.reservationId}`} className="text-forest underline underline-offset-4">
            Open the booking
          </Link>
        </p>
      )}

      {editable ? (
        <form onSubmit={review} className="mt-4 space-y-3 border-t border-forest/10 pt-4" noValidate>
          <h3 className="text-sm font-medium text-charcoal">Move / change dates</h3>
          <Field id="tape-room" label={bar.status === "PENDING" ? "Assign a room" : "Room"} hint={!isBlock ? "Rooms of the same type only. To change type, cancel and rebook." : undefined}>
            <Select id="tape-room" value={roomId} disabled={!caps.room} onChange={(e) => setRoomId(e.target.value)}>
              {bar.status === "PENDING" && <option value="">Not yet (pending)</option>}
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="tape-in" label={isBlock ? "First blocked night" : "Check-in"}>
              <Input id="tape-in" type="date" value={checkIn} disabled={!caps.start} onChange={(e) => setCheckIn(e.target.value)} />
            </Field>
            <Field id="tape-out" label={isBlock ? "Available again on" : "Check-out"}>
              <Input id="tape-out" type="date" value={checkOut} disabled={!caps.end} onChange={(e) => setCheckOut(e.target.value)} />
            </Field>
          </div>
          {bar.status === "CHECKED_IN" && <p className="text-xs text-charcoal-light">Guests are in: only the check-out can change.</p>}
          {error && <FormMessage type="error">{error}</FormMessage>}
          <Button type="submit" className="min-h-11 w-full">
            Review change
          </Button>
        </form>
      ) : (
        <p className="mt-4 border-t border-forest/10 pt-4 text-sm text-charcoal-light">
          {isBlock ? "Only an Admin can change blocks." : "This stay can't be changed any more."}
        </p>
      )}
    </div>
  );
}

/** After selecting empty nights: start a booking there, or (Admin and above) block them. */
export function CreateChooser({
  selection,
  room,
  canBlock,
  onClose,
  onBlocked,
}: {
  selection: { roomId: string; checkIn: string; checkOut: string } | null;
  room: TapeRoom | null;
  canBlock: boolean;
  onClose: () => void;
  onBlocked: (message: string) => void;
}) {
  return (
    <Sheet open={selection !== null && room !== null} onClose={onClose} label="Empty nights" placement="dialog">
      {selection && room && <ChooserBody selection={selection} room={room} canBlock={canBlock} onClose={onClose} onBlocked={onBlocked} />}
    </Sheet>
  );
}

function ChooserBody({ selection, room, canBlock, onClose, onBlocked }: { selection: { roomId: string; checkIn: string; checkOut: string }; room: TapeRoom; canBlock: boolean; onClose: () => void; onBlocked: (m: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const href = `/admin/bookings/new?room=${selection.roomId}&checkIn=${selection.checkIn}&checkOut=${selection.checkOut}`;

  const block = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const formData = new FormData();
      formData.set("roomId", selection.roomId);
      formData.set("startDate", selection.checkIn);
      formData.set("endDate", selection.checkOut);
      formData.set("reason", reason);
      const result = await createRoomBlock(null, formData);
      if (result.ok) onBlocked(`Room ${room.name} blocked. ${result.message}`);
      else setError(result.fieldErrors?.reason ?? result.error);
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-forest">Room {room.name}</h2>
          <p className="text-sm text-charcoal-light">{range(selection.checkIn, selection.checkOut)}</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-md px-3 text-sm text-forest hover:bg-forest/5">
          Close
        </button>
      </div>
      <Link href={href} className={buttonClasses({ className: "mt-3 min-h-11 w-full" })}>
        New booking
      </Link>
      {canBlock && (
        <form onSubmit={block} className="mt-5 space-y-3 border-t border-forest/10 pt-4" noValidate>
          <h3 className="text-sm font-medium text-charcoal">Block dates</h3>
          <Field id="tape-block-reason" label="Reason" hint="Maintenance, owner use…">
            <Input id="tape-block-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <FormMessage type="error">{error}</FormMessage>}
          <Button type="submit" variant="secondary" disabled={pending} className="min-h-11 w-full">
            {pending ? "Blocking…" : "Block these dates"}
          </Button>
        </form>
      )}
    </div>
  );
}
