"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Bold, Heading2, Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Plus, Quote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { GuideMarkdown } from "@/components/guides/guide-markdown";
import { MediaImage } from "@/components/media/media-image";
import type { PickerMedia } from "@/components/media/placement-manager";
import type { ActionResult } from "@/lib/actions";
import { publishProblems, SEO_HINTS } from "@/lib/guides/rules";
import type { FaqEntry } from "@/lib/guides/schemas";
import { saveGuide } from "./actions";

export type GuideFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverMediaId: string | null;
  tags: string;
  authorName: string;
  authorRole: string;
  status: "DRAFT" | "PUBLISHED";
  /** yyyy-mm-dd, Kathmandu day. */
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  faq: FaqEntry[];
  placeholderFields: string[];
};

type Tool = { label: string; icon: typeof Bold; apply: (selected: string) => { text: string; select?: [number, number] } };

const wrap = (before: string, after: string, fallback: string) => (selected: string) => ({
  text: `${before}${selected || fallback}${after}`,
  select: [before.length, before.length + (selected || fallback).length] as [number, number],
});
const linePrefix = (prefix: string, fallback: string) => (selected: string) => ({
  text: (selected || fallback).split("\n").map((l, i) => (prefix === "1. " ? `${i + 1}. ` : prefix) + l).join("\n"),
});

const TOOLS: Tool[] = [
  { label: "Heading", icon: Heading2, apply: linePrefix("## ", "Heading") },
  { label: "Subheading", icon: Heading3, apply: linePrefix("### ", "Subheading") },
  { label: "Bold", icon: Bold, apply: wrap("**", "**", "bold text") },
  { label: "Italic", icon: Italic, apply: wrap("*", "*", "italic text") },
  { label: "Bulleted list", icon: List, apply: linePrefix("- ", "List item") },
  { label: "Numbered list", icon: ListOrdered, apply: linePrefix("1. ", "List item") },
  { label: "Quote", icon: Quote, apply: linePrefix("> ", "Quote") },
  {
    label: "Link",
    icon: Link2,
    apply: (selected) => {
      const text = selected || "link text";
      return { text: `[${text}](/explore)`, select: [text.length + 3, text.length + 10] };
    },
  },
];

function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.trim().length;
  const tone = n === 0 ? "text-charcoal-light" : n > max ? "text-warning" : n >= min ? "text-success" : "text-charcoal-light";
  return (
    <span className={`text-xs ${tone}`}>
      {n} characters. Aim for {min}–{max}.
    </span>
  );
}

/** The guide form: Markdown body with a toolbar and live preview, FAQ list, SEO fields and a publish checklist. */
export function GuideEditor({ initial, library }: { initial: GuideFormValues; library: PickerMedia[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(saveGuide, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const err = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `g-${name}-error` : undefined,
  });

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [body, setBody] = useState(initial.body);
  const [cover, setCover] = useState(initial.coverMediaId);
  const [author, setAuthor] = useState(initial.authorName);
  const [status, setStatus] = useState(initial.status);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [faq, setFaq] = useState<FaqEntry[]>(initial.faq);
  const [view, setView] = useState<"write" | "preview">("write");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverDialog = useRef<HTMLDialogElement>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);

  const published = initial.status === "PUBLISHED";
  const problems = useMemo(
    () =>
      publishProblems({
        title,
        slug: slug || "x",
        excerpt,
        body,
        authorName: author,
        coverMediaId: cover,
        seoTitle,
        seoDescription,
        placeholderFields: initial.placeholderFields,
      }),
    [title, slug, excerpt, body, author, cover, seoTitle, seoDescription, initial.placeholderFields],
  );
  const coverMedia = library.find((m) => m.id === cover);

  function edit(apply: Tool["apply"]) {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const out = apply(body.slice(a, b));
    const next = body.slice(0, a) + out.text + body.slice(b);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const [s, e] = out.select ?? [out.text.length, out.text.length];
      el.setSelectionRange(a + s, a + e);
    });
  }

  function insertImage(media: PickerMedia) {
    imageDialog.current?.close();
    const alt = (media.altText || "").replace(/[\[\]]/g, "");
    edit(() => ({ text: `\n\n![${alt}](${media.url})\n\n` }));
  }

  const moveFaq = (i: number, d: number) =>
    setFaq((list) => {
      const to = i + d;
      if (to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[to]] = [copy[to], copy[i]];
      return copy;
    });

  return (
    <form action={action} className="max-w-5xl space-y-8">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="coverMediaId" value={cover ?? ""} />
      <input type="hidden" name="faq" value={JSON.stringify(faq.filter((f) => f.question.trim() || f.answer.trim()))} />

      {initial.placeholderFields.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">
          Placeholder text remains in: {initial.placeholderFields.join(", ")}. Replace it, then tick “I’ve reviewed this” below. The guide cannot be published until then.
        </p>
      )}

      <section className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="g-title" label="Title" error={errors?.title}>
            <Input id="g-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} {...err("title")} />
          </Field>
        </div>
        <Field id="g-slug" label="URL slug" error={errors?.slug} hint={published ? "Locked: this guide is published." : "Leave blank to make it from the title. Lowercase letters, numbers and hyphens."}>
          <Input id="g-slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} readOnly={published} maxLength={80} {...err("slug")} />
        </Field>
        <Field id="g-tags" label="Tags" hint="Separated by commas." error={errors?.tags}>
          <Input id="g-tags" name="tags" defaultValue={initial.tags} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="g-excerpt" label="Excerpt" error={errors?.excerpt} hint="Shown on the guides list and used as a summary. One or two sentences.">
            <Textarea id="g-excerpt" name="excerpt" rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={400} {...err("excerpt")} />
          </Field>
        </div>
        <Field id="g-author" label="Author" error={errors?.authorName} hint="Required before publishing.">
          <Input id="g-author" name="authorName" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} {...err("authorName")} />
        </Field>
        <Field id="g-role" label="Author role (optional)" error={errors?.authorRole}>
          <Input id="g-role" name="authorRole" defaultValue={initial.authorRole} maxLength={120} />
        </Field>
      </section>

      <section aria-labelledby="g-cover-h">
        <h2 id="g-cover-h" className="mb-2 text-sm font-medium text-charcoal">Cover image</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative h-24 w-36 shrink-0 overflow-hidden bg-sage">
            {coverMedia && <MediaImage media={coverMedia} sizes="144px" alt="" className="object-cover" />}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => coverDialog.current?.showModal()}>{cover ? "Change cover" : "Choose cover"}</Button>
            {cover && <Button variant="ghost" onClick={() => setCover(null)}>Remove</Button>}
          </div>
          {errors?.coverMediaId && <p className="text-xs text-error">{errors.coverMediaId}</p>}
        </div>
        <p className="mt-1 text-xs text-charcoal-light">Also the share image. Upload new photos in Media → Library.</p>
      </section>

      <section aria-labelledby="g-body-h">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="g-body-h" className="text-sm font-medium text-charcoal">Body (Markdown)</h2>
          <div role="group" aria-label="View" className="flex gap-1 lg:hidden">
            <Button size="sm" variant={view === "write" ? "primary" : "secondary"} onClick={() => setView("write")}>Write</Button>
            <Button size="sm" variant={view === "preview" ? "primary" : "secondary"} onClick={() => setView("preview")}>Preview</Button>
          </div>
        </div>
        <div role="toolbar" aria-label="Formatting" className="mb-2 flex flex-wrap gap-1">
          {TOOLS.map((t) => (
            <Button key={t.label} size="sm" variant="secondary" aria-label={t.label} title={t.label} onClick={() => edit(t.apply)}>
              <t.icon size={16} aria-hidden="true" />
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => imageDialog.current?.showModal()}>
            <ImageIcon size={16} aria-hidden="true" /> Image
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={view === "preview" ? "hidden lg:block" : ""}>
            <Textarea ref={bodyRef} id="g-body" name="body" aria-labelledby="g-body-h" rows={26} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" {...err("body")} />
            {errors?.body && <p id="g-body-error" className="mt-1 text-xs text-error">{errors.body}</p>}
          </div>
          <div className={`max-h-[40rem] overflow-y-auto border border-forest/15 bg-cream px-5 py-3 ${view === "write" ? "hidden lg:block" : ""}`} aria-label="Live preview">
            {body.trim() ? <GuideMarkdown source={body} /> : <p className="text-sm text-charcoal-light">The preview appears here.</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="g-faq-h">
        <h2 id="g-faq-h" className="mb-1 text-sm font-medium text-charcoal">FAQ block (optional)</h2>
        <p className="mb-3 text-xs text-charcoal-light">Shown at the end of the guide and sent to search engines as FAQ data. Only add questions you have real answers for.</p>
        <ul className="space-y-3">
          {faq.map((entry, i) => (
            <li key={i} className="space-y-2 rounded-md border border-forest/15 bg-white p-3">
              <Field id={`g-faq-q-${i}`} label={`Question ${i + 1}`}>
                <Input id={`g-faq-q-${i}`} value={entry.question} maxLength={300} onChange={(e) => setFaq((l) => l.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              </Field>
              <Field id={`g-faq-a-${i}`} label="Answer">
                <Textarea id={`g-faq-a-${i}`} rows={3} value={entry.answer} maxLength={2000} onChange={(e) => setFaq((l) => l.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
              </Field>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" aria-label="Move up" onClick={() => moveFaq(i, -1)} disabled={i === 0}><ArrowUp size={16} aria-hidden="true" /></Button>
                <Button size="sm" variant="secondary" aria-label="Move down" onClick={() => moveFaq(i, 1)} disabled={i === faq.length - 1}><ArrowDown size={16} aria-hidden="true" /></Button>
                <Button size="sm" variant="danger" onClick={() => setFaq((l) => l.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /> Remove</Button>
              </div>
            </li>
          ))}
        </ul>
        {errors?.faq && <p className="mt-1 text-xs text-error">{errors.faq}</p>}
        {faq.length < 20 && (
          <Button className="mt-3" variant="secondary" onClick={() => setFaq((l) => [...l, { question: "", answer: "" }])}>
            <Plus size={16} aria-hidden="true" /> Add a question
          </Button>
        )}
      </section>

      <section aria-labelledby="g-seo-h" className="grid gap-5">
        <h2 id="g-seo-h" className="text-sm font-medium text-charcoal">Search and sharing</h2>
        <Field id="g-seo-title" label="SEO title" error={errors?.seoTitle}>
          <Input id="g-seo-title" name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={120} {...err("seoTitle")} />
          <Counter value={seoTitle} {...SEO_HINTS.title} />
        </Field>
        <Field id="g-seo-desc" label="Meta description" error={errors?.seoDescription}>
          <Textarea id="g-seo-desc" name="seoDescription" rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={320} {...err("seoDescription")} />
          <Counter value={seoDescription} {...SEO_HINTS.description} />
        </Field>
      </section>

      <section aria-labelledby="g-pub-h" className="space-y-4 rounded-md border border-forest/15 bg-white p-4">
        <h2 id="g-pub-h" className="text-sm font-medium text-charcoal">Publishing</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="g-status" label="Status" error={errors?.status}>
            <Select id="g-status" name="status" value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}>
              <option value="DRAFT">Draft (not on the website)</option>
              <option value="PUBLISHED">Published</option>
            </Select>
          </Field>
          <Field id="g-date" label="Publish date" error={errors?.publishedAt} hint="Blank = today when published. A future date keeps it hidden until then.">
            <Input id="g-date" name="publishedAt" type="date" defaultValue={initial.publishedAt} {...err("publishedAt")} />
          </Field>
        </div>
        {initial.placeholderFields.length > 0 && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="markReviewed" className="mt-1" />
            <span>I’ve reviewed this: the placeholder text has been replaced with real content.</span>
          </label>
        )}
        {status === "PUBLISHED" && problems.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
            <p className="font-medium">Not ready to publish yet:</p>
            <ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          {initial.id && (
            <a className="text-sm text-forest underline underline-offset-4" href={`/admin/content/guides/${initial.id}/preview`} target="_blank" rel="noopener">
              Preview as visitors will see it
            </a>
          )}
        </div>
        <ActionMessage result={result} />
      </section>

      <Picker dialogRef={coverDialog} title="Choose a cover" library={library} onPick={(m) => { setCover(m.id); coverDialog.current?.close(); }} />
      <Picker dialogRef={imageDialog} title="Insert an image" library={library} onPick={insertImage} />
    </form>
  );
}

function Picker({ dialogRef, title, library, onPick }: { dialogRef: React.RefObject<HTMLDialogElement | null>; title: string; library: PickerMedia[]; onPick: (m: PickerMedia) => void }) {
  return (
    <dialog ref={dialogRef} aria-label={title} className="m-auto w-[min(60rem,calc(100%-2rem))] rounded-md p-0 backdrop:bg-forest/50">
      <div className="flex items-center justify-between border-b border-forest/10 px-4 py-3">
        <h2 className="font-display text-lg text-forest">{title}</h2>
        <Button variant="ghost" onClick={() => dialogRef.current?.close()}>Close</Button>
      </div>
      <ul className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
        {library.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => onPick(m)} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-forest">
              <span className="relative block aspect-[4/3] overflow-hidden bg-sage"><MediaImage media={m} sizes="240px" alt="" className="object-cover" /></span>
              <span className="mt-1 line-clamp-2 block text-xs text-charcoal">{m.altText || m.originalFilename || "Untitled"}</span>
              {m.altNeedsReview && <span className="text-xs text-warning">Alt text needs review</span>}
            </button>
          </li>
        ))}
        {library.length === 0 && <li className="text-sm text-charcoal-light">No images yet. Upload in Media → Library.</li>}
      </ul>
    </dialog>
  );
}
