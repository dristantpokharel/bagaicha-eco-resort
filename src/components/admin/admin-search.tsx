"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { searchAdminAction } from "@/app/admin/search-actions";
import { SEARCH_MIN_CHARS, type ChipTone, type SearchGroup } from "@/lib/admin/search-types";

const DEBOUNCE_MS = 250;

const CHIP: Record<ChipTone, string> = {
  neutral: "border-charcoal/20 bg-charcoal/5 text-charcoal-light",
  pending: "border-warning/40 bg-warning/10 text-warning",
  good: "border-success/40 bg-success/10 text-success",
  bad: "border-error/30 bg-error/5 text-error",
  info: "border-forest/30 bg-forest/10 text-forest",
};

const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform);
const subscribeNothing = () => () => {};

/** Search in the admin header: Ctrl/⌘+K on desktop, an icon on phones that opens a full-screen search. */
export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const apple = useSyncExternalStore(subscribeNothing, isApple, () => false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-haspopup="dialog"
        className="inline-flex size-11 items-center justify-center rounded-md text-forest hover:bg-forest/5 focus-visible:outline-2 focus-visible:outline-forest md:hidden"
      >
        <Search aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="hidden h-10 w-64 items-center gap-2 rounded-md border border-charcoal/25 bg-white px-3 text-sm text-charcoal-light hover:border-forest/50 focus-visible:outline-2 focus-visible:outline-forest md:flex"
      >
        <Search aria-hidden="true" className="size-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-charcoal/20 px-1.5 text-xs">{apple ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Search" placement="palette">
        <SearchPanel onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; groups: SearchGroup[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const latest = useRef(0);
  const activeRef = useRef<HTMLAnchorElement>(null);

  const q = query.trim();
  const searchable = q.length >= SEARCH_MIN_CHARS;

  // Debounced search; an answer for an older query is dropped.
  useEffect(() => {
    if (!searchable) return;
    const id = ++latest.current;
    const timer = setTimeout(() => {
      searchAdminAction(q).then(
        (groups) => {
          if (id !== latest.current) return;
          setFailed(false);
          setFound({ q, groups });
          setActive(0);
        },
        () => id === latest.current && setFailed(true),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, searchable]);

  const groups = searchable ? (found?.groups ?? []) : [];
  const flat = groups.flatMap((g) => g.hits);
  const pending = searchable && found?.q !== q && !failed;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, found]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[Math.min(active, flat.length - 1)].href);
    }
  };

  const hitId = (i: number) => `${listId}-hit-${i}`;
  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.hits.length, 0));

  return (
    <>
      <div className="flex items-center gap-2 border-b border-forest/10 px-3 py-2">
        <Search aria-hidden="true" className="size-5 shrink-0 text-charcoal-light" />
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={listId}
          aria-activedescendant={flat.length > 0 ? hitId(Math.min(active, flat.length - 1)) : undefined}
          aria-label="Search bookings, guests, enquiries and inventory"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Reference, name, phone, email, item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-charcoal-light [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-forest hover:bg-forest/5 focus-visible:outline-2 focus-visible:outline-forest"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" aria-busy={pending}>
        <p className="sr-only" role="status" aria-live="polite">
          {searchable && !pending && !failed ? `${flat.length} result${flat.length === 1 ? "" : "s"}` : ""}
        </p>
        {!searchable ? (
          <p className="px-2 py-6 text-center text-sm text-charcoal-light">Type at least {SEARCH_MIN_CHARS} characters. Phone numbers match on their last digits.</p>
        ) : failed ? (
          <p className="px-2 py-6 text-center text-sm text-error">Search failed. Check your connection and try again.</p>
        ) : pending && flat.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-charcoal-light">Searching…</p>
        ) : flat.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-charcoal-light">Nothing found for “{q}”.</p>
        ) : (
          <div id={listId} role="listbox" aria-label="Results" className={pending ? "opacity-60" : ""}>
            {groups.map((group, gi) => (
              <div key={group.kind} role="group" aria-labelledby={`${listId}-${group.kind}`} className="mb-2">
                <h3 id={`${listId}-${group.kind}`} className="px-2 pt-1 pb-1 text-xs font-semibold tracking-wide text-charcoal-light uppercase">
                  {group.label}
                </h3>
                {group.hits.map((hit, hi) => {
                  const i = starts[gi] + hi;
                  const isActive = i === Math.min(active, flat.length - 1);
                  return (
                    <a
                      key={`${hit.kind}-${hit.id}`}
                      ref={isActive ? activeRef : undefined}
                      id={hitId(i)}
                      role="option"
                      aria-selected={isActive}
                      href={hit.href}
                      onClick={(e) => {
                        e.preventDefault();
                        go(hit.href);
                      }}
                      onMouseMove={() => setActive(i)}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-md px-2 py-1.5 ${isActive ? "bg-forest/10" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-charcoal">{hit.title}</span>
                        <span className="block truncate text-xs text-charcoal-light">{hit.subtitle}</span>
                      </span>
                      {hit.chip && (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CHIP[hit.chip.tone]}`}>
                          {hit.chip.label}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="hidden border-t border-forest/10 px-3 py-1.5 text-xs text-charcoal-light md:block">
        ↑↓ to move · Enter to open · Esc to close
      </p>
    </>
  );
}
