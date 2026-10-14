"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { parseDateOnly } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/labels";
import {
  buildProposal,
  candidateFor,
  capabilities,
  daysBetween,
  evaluate,
  freeRun,
  isNightFree,
  packLanes,
  shiftDate,
  type Caps,
  type Candidate,
  type DragMode,
  type Evaluation,
  type Proposal,
  type TapeBar,
  type TapeData,
} from "@/lib/booking/tape";
import type { BookingStatus } from "@/generated/prisma/enums";
import { confirmLine } from "../../actions";
import { moveBlockAction, moveBookingAction, type TapeResult, type UndoInfo } from "../../tape-actions";
import { BarPanel, CreateChooser, ProposalDialog, roomNameIn } from "./tape-dialogs";

const BAR_STYLES: Record<BookingStatus, string> = {
  PENDING: "border-warning bg-warning/15 text-warning",
  CONFIRMED: "border-forest bg-forest text-cream",
  CHECKED_IN: "border-success bg-success text-white",
  CHECKED_OUT: "border-sage-muted bg-sage text-ink",
  CANCELLED: "",
};
const BLOCK_STYLE =
  "border-charcoal/30 bg-charcoal/15 text-charcoal bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.08)_4px,rgba(0,0,0,0.08)_8px)]";

type RowDef = {
  key: string;
  kind: "room" | "unassigned";
  label: string;
  sub?: string;
  roomId: string | null;
  typeId: string;
  muted?: boolean;
  bars: TapeBar[];
};
type Section = { id: string; name: string; rows: RowDef[] };

type Drag = { bar: TapeBar; mode: DragMode; caps: Caps; dayDelta: number; rowKey: string | null; cand: Candidate | null; evaluation: Evaluation | null };
type Toast = { id: number; message: string; undo: UndoInfo | null; tone: "ok" | "error" };
type Sel = { roomId: string; anchor: string; current: string };

/** Rooms grouped by type; requests with no room yet are packed into the fewest "Unassigned" rows. */
function buildSections(data: TapeData): Section[] {
  return data.types.map((type) => {
    const rows: RowDef[] = [];
    for (const room of type.rooms) {
      const bars = data.bars.filter((b) => b.roomId === room.id);
      // Archived rooms only appear while they still have something in view.
      if (!room.isActive && bars.length === 0) continue;
      rows.push({ key: room.id, kind: "room", label: room.name, sub: room.isActive ? undefined : "archived", roomId: room.id, typeId: type.id, muted: !room.isActive, bars });
    }
    const pending = data.bars.filter((b) => b.kind === "booking" && b.roomId === null && b.roomTypeId === type.id);
    packLanes(pending).forEach((lane, i) =>
      rows.push({ key: `${type.id}-unassigned-${i}`, kind: "unassigned", label: "Unassigned", sub: "pending request", roomId: null, typeId: type.id, bars: lane }),
    );
    return { id: type.id, name: type.name, rows };
  });
}

/** Screen-reader wording for drags (the defaults read out internal ids). Moves are also reported in the status line. */
const ANNOUNCEMENTS = {
  announcements: {
    onDragStart: ({ active }: { active: { data: { current?: { bar?: TapeBar } } } }) => `Picked up ${active.data.current?.bar?.title ?? "a stay"}.`,
    onDragOver: () => undefined,
    onDragMove: () => undefined,
    onDragEnd: () => "Dropped. Review the change in the dialog.",
    onDragCancel: () => "Move cancelled.",
  },
  screenReaderInstructions: { draggable: "Press Enter to open the form to move this stay or change its dates." },
};

const short = (date: string) => formatInTimeZone(parseDateOnly(date)!, "UTC", "d MMM");

export function TapeChart({ data, start, days, canBlock }: { data: TapeData; start: string; days: number; canBlock: boolean }) {
  const router = useRouter();
  const end = shiftDate(start, days);
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => shiftDate(start, i)), [start, days]);
  const sections = useMemo(() => buildSections(data), [data]);
  const barRow = useMemo(() => new Map(sections.flatMap((s) => s.rows.flatMap((r) => r.bars.map((b) => [b.id, r] as const)))), [sections]);

  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const dayWidth = useRef(40);
  const firstDayCell = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [panelBar, setPanelBar] = useState<TapeBar | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [chooser, setChooser] = useState<{ roomId: string; checkIn: string; checkOut: string } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [undoing, setUndoing] = useState(false);

  const showToast = (message: string, undo: UndoInfo | null, tone: Toast["tone"] = "ok") => setToast({ id: Date.now(), message, undo, tone });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undo ? 10_000 : 6_000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Touch: press and hold to drag, so a swipe still scrolls the chart. Mouse: a small movement starts a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
  );

  // ─── Dragging bars ───
  const update = (event: DragMoveEvent | DragStartEvent, base: Drag): Drag => {
    const rect = event.active.rect.current;
    const dx = "delta" in event && rect.translated && rect.initial ? rect.translated.left - rect.initial.left : "delta" in event ? event.delta.x : 0;
    const dayDelta = Math.round(dx / dayWidth.current);
    const over = ("over" in event ? event.over : null)?.data.current?.row as RowDef | undefined;
    const row = base.mode === "move" ? over : barRow.get(base.bar.id);
    if (!row) return { ...base, dayDelta, rowKey: null, cand: null, evaluation: null };
    const cand = candidateFor(base.bar, base.mode, dayDelta, { roomId: row.roomId, typeId: row.typeId }, base.caps);
    return { ...base, dayDelta, rowKey: row.key, cand, evaluation: evaluate(base.bar, cand, data, { canBlock }) };
  };

  const onDragStart = (event: DragStartEvent) => {
    const { bar, mode } = event.active.data.current as { bar: TapeBar; mode: DragMode };
    if (firstDayCell.current) dayWidth.current = firstDayCell.current.getBoundingClientRect().width || 40;
    const next = { bar, mode, caps: capabilities(bar, data, canBlock), dayDelta: 0, rowKey: null, cand: null, evaluation: null } satisfies Drag;
    dragRef.current = next;
    setDrag(next);
  };
  const onDragMove = (event: DragMoveEvent) => {
    if (!dragRef.current) return;
    const next = update(event, dragRef.current);
    const prev = dragRef.current;
    if (next.dayDelta === prev.dayDelta && next.rowKey === prev.rowKey) return;
    dragRef.current = next;
    setDrag(next);
  };
  const onDragEnd = (event: DragEndEvent) => {
    const current = dragRef.current && update(event as unknown as DragMoveEvent, dragRef.current);
    dragRef.current = null;
    setDrag(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    if (!current?.cand || !current.evaluation) return;
    if (!current.evaluation.ok) {
      if (!current.evaluation.noop) showToast(`Not moved: ${current.evaluation.reason}`, null, "error");
      return;
    }
    const built = buildProposal(current.bar, current.cand, data, { canBlock });
    if (built.ok) setProposal(built.proposal);
  };
  const onDragCancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  // ─── Running a confirmed change ───
  const execute = async (p: Proposal, notify: boolean): Promise<TapeResult> => {
    let result: TapeResult;
    if (p.op === "assign") {
      const formData = new FormData();
      formData.set("bookingId", p.bar.id);
      formData.set("roomId", p.to.roomId!);
      const r = await confirmLine(null, formData);
      result = r.ok ? { ok: true, message: r.message, emailed: false, undo: null } : { ok: false, error: r.error };
    } else if (p.op === "block") {
      result = await moveBlockAction({
        blockId: p.bar.id,
        ...(p.roomChanged && p.to.roomId ? { roomId: p.to.roomId } : {}),
        ...(p.datesChanged ? { startDate: p.to.checkIn, endDate: p.to.checkOut } : {}),
      });
    } else {
      result = await moveBookingAction({
        bookingId: p.bar.id,
        ...(p.roomChanged && p.to.roomId ? { roomId: p.to.roomId } : {}),
        ...(p.datesChanged ? { checkIn: p.to.checkIn, checkOut: p.to.checkOut } : {}),
        notify,
      });
    }
    if (result.ok) {
      setProposal(null);
      setPanelBar(null);
      showToast(result.message, result.undo);
    }
    return result;
  };

  const undo = async () => {
    if (!toast?.undo) return;
    setUndoing(true);
    const { undo: info } = toast;
    const result =
      info.kind === "move"
        ? await moveBookingAction({ bookingId: info.bookingId, roomId: info.roomId, checkIn: info.checkIn, checkOut: info.checkOut, notify: info.notify, undo: true })
        : await moveBlockAction({ blockId: info.blockId, roomId: info.roomId, startDate: info.startDate, endDate: info.endDate, undo: true });
    setUndoing(false);
    if (result.ok) showToast(result.message, null);
    else showToast(`Couldn't undo: ${result.error}`, null, "error");
  };

  // ─── Selecting empty nights ───
  // The selection lives in a ref as well as in state, and the window listeners are always on: a quick tap can
  // release before a listener added by an effect after the state change would be in place.
  const selRef = useRef<Sel | null>(null);
  const select = (next: Sel | null) => {
    selRef.current = next;
    setSel(next);
  };
  useEffect(() => {
    const finish = () => {
      const current = selRef.current;
      if (!current) return;
      selRef.current = null;
      setSel(null);
      const run = freeRun(data, current.roomId, current.anchor, current.current);
      if (!run) return;
      if (canBlock) setChooser({ roomId: current.roomId, ...run });
      else router.push(`/admin/bookings/new?room=${current.roomId}&checkIn=${run.checkIn}&checkOut=${run.checkOut}`);
    };
    const cancel = () => {
      selRef.current = null;
      setSel(null);
    };
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [data, canBlock, router]);

  const selRun = sel ? freeRun(data, sel.roomId, sel.anchor, sel.current) : null;
  const today = data.today;

  // ─── Status line ───
  let hint = "Drag a stay to move it, or its edges to change dates. Tap a stay for a form. Click empty nights to start a booking. On a phone, touch and hold to drag.";
  let hintTone = "text-charcoal-light";
  if (drag) {
    if (!drag.evaluation || !drag.cand) hint = "Drop on a room row.";
    else if (drag.evaluation.ok) {
      hint = `${roomNameIn(data, drag.cand.roomId)} · ${short(drag.cand.checkIn)} → ${short(drag.cand.checkOut)}`;
      hintTone = "text-success";
    } else if (drag.evaluation.noop) hint = "Drop somewhere else to change something.";
    else {
      hint = drag.evaluation.reason;
      hintTone = "text-error";
    }
  }

  const gridCols = `var(--tape-label) repeat(${days}, minmax(var(--tape-day), 1fr))`;
  const barCols = (bar: { checkIn: string; checkOut: string }) => {
    const from = bar.checkIn < start ? start : bar.checkIn;
    const to = bar.checkOut > end ? end : bar.checkOut;
    if (to <= from) return null;
    return { start: daysBetween(start, from) + 1, end: daysBetween(start, to) + 1, clipStart: bar.checkIn < start, clipEnd: bar.checkOut > end };
  };

  const everyType = data.types.every((t) => t.rooms.length === 0);
  const chooserRoom = chooser ? (data.types.flatMap((t) => t.rooms).find((r) => r.id === chooser.roomId) ?? null) : null;

  return (
    <div className="space-y-2">
      <p role="status" aria-live="polite" className={`min-h-10 text-xs sm:min-h-5 sm:text-sm ${hintTone}`}>
        {hint}
      </p>

      {everyType ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">No rooms yet. Add rooms under Rooms to see them here.</p>
      ) : (
        <div className="max-h-[calc(100dvh-17rem)] min-h-64 overflow-auto rounded-lg border border-forest/10 bg-white [--tape-day:2.5rem] [--tape-label:6.5rem] select-none md:[--tape-day:2.25rem] md:[--tape-label:10rem]">
          <DndContext sensors={sensors} accessibility={ANNOUNCEMENTS} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
            <div style={{ minWidth: `calc(var(--tape-label) + ${days} * var(--tape-day))` }}>
              <div className="sticky top-0 z-30 grid border-b border-forest/10 bg-cream text-center text-xs" style={{ gridTemplateColumns: gridCols }}>
                <div className="sticky left-0 z-10 flex items-end bg-cream px-3 py-2 text-left font-medium text-charcoal-light">Room</div>
                {dayList.map((day, i) => {
                  const date = parseDateOnly(day)!;
                  const isToday = day === today;
                  return (
                    <div
                      key={day}
                      ref={i === 0 ? firstDayCell : undefined}
                      aria-current={isToday ? "date" : undefined}
                      className={`py-1 leading-tight ${isToday ? "bg-forest/10 font-semibold text-forest" : "text-charcoal-light"}`}
                    >
                      <span className="block text-[0.625rem]">{i === 0 || date.getUTCDate() === 1 ? formatInTimeZone(date, "UTC", "MMM") : " "}</span>
                      <span className="block">{formatInTimeZone(date, "UTC", "EEEEE")}</span>
                      <span className="block">{date.getUTCDate()}</span>
                    </div>
                  );
                })}
              </div>

              {sections.map((section) => (
                <section key={section.id} aria-label={section.name}>
                  <h3 className="border-b border-forest/10 bg-sage/40 text-xs font-semibold tracking-wide text-forest uppercase">
                    <span className="sticky left-0 inline-block px-3 py-1">{section.name}</span>
                  </h3>
                  {section.rows.length === 0 && <p className="px-3 py-2 text-xs text-charcoal-light">No rooms of this type yet.</p>}
                  {section.rows.map((row) => (
                    <RowView
                      key={row.key}
                      row={row}
                      dayList={dayList}
                      today={today}
                      gridCols={gridCols}
                      drag={drag}
                      data={data}
                      canBlock={canBlock}
                      barCols={barCols}
                      selRun={sel && sel.roomId === row.roomId ? selRun : null}
                      onStartSel={(day) => select({ roomId: row.roomId!, anchor: day, current: day })}
                      onExtendSel={(day) => selRef.current && selRef.current.roomId === row.roomId && select({ ...selRef.current, current: day })}
                      onOpen={(bar) => !justDragged.current && setPanelBar(bar)}
                    />
                  ))}
                </section>
              ))}
            </div>
          </DndContext>
        </div>
      )}

      <ProposalDialog proposal={proposal} data={data} run={execute} onClose={() => setProposal(null)} />
      <BarPanel
        bar={panelBar && !proposal ? panelBar : null}
        data={data}
        caps={panelBar ? capabilities(panelBar, data, canBlock) : null}
        canBlock={canBlock}
        onClose={() => setPanelBar(null)}
        onPropose={setProposal}
      />
      <CreateChooser
        selection={chooser}
        room={chooserRoom}
        canBlock={canBlock}
        onClose={() => setChooser(null)}
        onBlocked={(message) => {
          setChooser(null);
          showToast(message, null);
        }}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 z-50 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-elevated md:right-6 md:bottom-6 md:left-auto md:w-[26rem] ${
            toast.tone === "error" ? "border-error/30 bg-white text-error" : "border-forest/20 bg-forest text-cream"
          }`}
        >
          <span className="min-w-0">{toast.message}</span>
          <span className="flex shrink-0 items-center gap-1">
            {toast.undo && (
              <Button type="button" variant="secondary" size="sm" disabled={undoing} onClick={undo} className="min-h-11 px-4">
                {undoing ? "Undoing…" : "Undo"}
              </Button>
            )}
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="min-h-11 min-w-11 rounded-md hover:bg-white/10">
              ×
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function RowView({
  row,
  dayList,
  today,
  gridCols,
  drag,
  data,
  canBlock,
  barCols,
  selRun,
  onStartSel,
  onExtendSel,
  onOpen,
}: {
  row: RowDef;
  dayList: string[];
  today: string;
  gridCols: string;
  drag: Drag | null;
  data: TapeData;
  canBlock: boolean;
  barCols: (bar: { checkIn: string; checkOut: string }) => { start: number; end: number; clipStart: boolean; clipEnd: boolean } | null;
  selRun: { checkIn: string; checkOut: string } | null;
  onStartSel: (day: string) => void;
  onExtendSel: (day: string) => void;
  onOpen: (bar: TapeBar) => void;
}) {
  const { setNodeRef } = useDroppable({ id: row.key, data: { row } });
  const over = drag?.rowKey === row.key;
  // While dragging a booking, rows of other room types are out of bounds.
  const blocked = drag && drag.bar.kind === "booking" && drag.bar.roomTypeId !== row.typeId;
  const ghost = over && drag?.cand ? barCols(drag.cand) : null;
  const creatable = row.kind === "room" && !row.muted;

  return (
    <div
      ref={setNodeRef}
      className={`grid border-b border-forest/10 ${blocked ? "opacity-40" : ""} ${over && drag?.evaluation ? (drag.evaluation.ok ? "bg-success/10" : drag.evaluation.noop ? "" : "bg-error/10") : ""}`}
      style={{ gridTemplateColumns: gridCols }}
    >
      <div className={`sticky left-0 z-10 bg-white px-3 py-1.5 text-sm ${row.muted ? "text-charcoal-light" : "text-charcoal"}`} style={{ gridColumn: 1, gridRow: 1 }}>
        {row.label}
        {row.sub && <span className="block text-[0.6875rem] text-charcoal-light">{row.sub}</span>}
      </div>
      {dayList.map((day, i) => {
        const inRun = selRun && day >= selRun.checkIn && day < selRun.checkOut;
        return (
          <div
            key={day}
            role="presentation"
            onPointerDown={creatable ? (e) => e.button === 0 && isNightFree(data, row.roomId!, day) && onStartSel(day) : undefined}
            onPointerEnter={creatable ? () => onExtendSel(day) : undefined}
            className={`border-l border-forest/5 ${day === today ? "bg-forest/5" : ""} ${inRun ? "bg-forest/25" : creatable ? "cursor-cell hover:bg-forest/10" : ""}`}
            style={{ gridColumn: i + 2, gridRow: 1 }}
          />
        );
      })}
      {row.bars.map((bar) => {
        const cols = barCols(bar);
        if (!cols) return null;
        return <BarView key={bar.id} bar={bar} cols={cols} caps={capabilities(bar, data, canBlock)} data={data} onOpen={onOpen} />;
      })}
      {ghost && drag?.evaluation && (drag.evaluation.ok || !drag.evaluation.noop) && (
        <div
          aria-hidden="true"
          className={`pointer-events-none z-[4] m-0.5 rounded-sm border-2 border-dashed ${drag.evaluation.ok ? "border-success bg-success/20" : "border-error bg-error/20"}`}
          style={{ gridColumn: `${ghost.start + 1} / ${ghost.end + 1}`, gridRow: 1 }}
        />
      )}
    </div>
  );
}

function BarView({
  bar,
  cols,
  caps,
  data,
  onOpen,
}: {
  bar: TapeBar;
  cols: { start: number; end: number; clipStart: boolean; clipEnd: boolean };
  caps: Caps;
  data: TapeData;
  onOpen: (bar: TapeBar) => void;
}) {
  const canMove = caps.drag && (caps.room || caps.shift);
  const { setNodeRef: moveNode, setActivatorNodeRef: moveGrip, listeners: moveEvents, transform, isDragging } = useDraggable({
    id: `${bar.id}:move`,
    data: { bar, mode: "move" satisfies DragMode },
    disabled: !canMove,
  });
  const { setNodeRef: startNode, listeners: startEvents } = useDraggable({
    id: `${bar.id}:start`,
    data: { bar, mode: "start" satisfies DragMode },
    disabled: !caps.start || cols.clipStart,
  });
  const { setNodeRef: endNode, listeners: endEvents } = useDraggable({
    id: `${bar.id}:end`,
    data: { bar, mode: "end" satisfies DragMode },
    disabled: !caps.end || cols.clipEnd,
  });

  const isBlock = bar.kind === "block";
  const label = isBlock ? `Blocked: ${bar.title}` : `${bar.title} · ${bar.reference}`;
  const description = `${label}${isBlock ? "" : `, ${BOOKING_STATUS_LABELS[bar.status!]}`}, ${roomNameIn(data, bar.roomId)}, ${short(bar.checkIn)} to ${short(bar.checkOut)}. ${
    caps.drag ? "Press Enter to move it or change its dates." : "Press Enter for details."
  }`;
  const handle = "absolute inset-y-0 z-[1] w-3 cursor-ew-resize after:absolute after:inset-y-1.5 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-current after:opacity-40";

  return (
    <div
      ref={moveNode}
      className={`relative m-0.5 flex min-w-0 items-stretch overflow-hidden rounded-sm border text-xs leading-tight whitespace-nowrap ${isBlock ? BLOCK_STYLE : BAR_STYLES[bar.status!]} ${
        isDragging ? "z-40 opacity-70 shadow-elevated" : "z-[5]"
      } ${canMove ? "cursor-grab" : ""}`}
      style={{ gridColumn: `${cols.start + 1} / ${cols.end + 1}`, gridRow: 1, transform: CSS.Translate.toString(transform) }}
    >
      <button
        type="button"
        ref={moveGrip}
        {...moveEvents}
        onClick={() => onOpen(bar)}
        aria-label={description}
        className="min-h-8 min-w-0 flex-1 truncate px-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
      >
        <span className="truncate">{label}</span>
      </button>
      {caps.start && !cols.clipStart && <span ref={startNode} {...startEvents} aria-hidden="true" className={`${handle} left-0`} />}
      {caps.end && !cols.clipEnd && <span ref={endNode} {...endEvents} aria-hidden="true" className={`${handle} right-0`} />}
    </div>
  );
}
