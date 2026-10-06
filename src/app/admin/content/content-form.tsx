"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { COLLECTIONS, type CollectionKey, type Field as FieldDef } from "@/lib/content/collections";
import { saveContentItem } from "./actions";

export type Option = { value: string; label: string };

export type ContentRow = {
  id?: string;
  /** Form value for every field, as the string the input shows. */
  values: Record<string, string>;
  placeholderFields: string[];
  sortOrder: number;
  isActive: boolean;
};

/** One form for every content collection, built from COLLECTIONS. */
export function ContentForm({
  collection: key,
  row,
  mediaOptions = [],
  sectionOptions = [],
}: {
  collection: CollectionKey;
  row?: ContentRow;
  mediaOptions?: Option[];
  sectionOptions?: Option[];
}) {
  const collection = COLLECTIONS[key];
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(saveContentItem, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const prefix = `c-${key}-${row?.id ?? "new"}`;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `${prefix}-${name}-error` : undefined,
  });

  const control = (f: FieldDef) => {
    const id = `${prefix}-${f.name}`;
    const value = row?.values[f.name] ?? "";
    const common = { id, name: f.name, defaultValue: value, ...a11y(f.name) };
    switch (f.kind) {
      case "textarea":
        return <Textarea {...common} rows={f.rows ?? 4} maxLength={f.max} required={f.required} />;
      case "lines":
        return <Textarea {...common} rows={Math.min(Math.max(2, value.split("\n").length + 1), 6)} />;
      case "int":
      case "float":
        return <Input {...common} inputMode={f.kind === "int" ? "numeric" : "decimal"} />;
      case "url":
        return <Input {...common} type="url" inputMode="url" placeholder="https://" />;
      case "select":
        return (
          <Select {...common}>
            <option value="">None</option>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        );
      case "media":
        return (
          <Select {...common}>
            <option value="">None</option>
            {mediaOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        );
      case "section":
        return (
          <Select {...common} required>
            <option value="">Choose a section</option>
            {sectionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        );
      default:
        return <Input {...common} maxLength={f.max} required={f.required} />;
    }
  };

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="collection" value={key} />
      {row?.id && <input type="hidden" name="id" value={row.id} />}
      <ActionMessage result={result} />

      <div className="grid gap-4 sm:grid-cols-2">
        {collection.fields.map((f) => {
          const wide = f.kind === "textarea" || f.kind === "lines";
          const flagged = row?.placeholderFields.includes(f.name);
          return (
            <div key={f.name} className={wide ? "sm:col-span-2" : ""}>
              <Field
                id={`${prefix}-${f.name}`}
                label={f.label + (flagged ? " (placeholder: edit to replace)" : "")}
                error={errors?.[f.name]}
                hint={f.hint}
              >
                {control(f)}
              </Field>
            </div>
          );
        })}
        {collection.slugFrom && (
          <Field
            id={`${prefix}-slug`}
            label="URL slug"
            error={errors?.slug}
            hint="Leave blank to make one from the name."
          >
            <Input id={`${prefix}-slug`} name="slug" maxLength={80} defaultValue={row?.values.slug ?? ""} {...a11y("slug")} />
          </Field>
        )}
        {!collection.singleton && (
          <>
            <Field id={`${prefix}-sort`} label="Display order" error={errors?.sortOrder} hint="Lower numbers show first.">
              <Input id={`${prefix}-sort`} name="sortOrder" inputMode="numeric" defaultValue={row?.sortOrder ?? 0} {...a11y("sortOrder")} />
            </Field>
            <label className="flex items-center gap-2 self-center text-sm text-charcoal">
              <input type="checkbox" name="isActive" defaultChecked={row ? row.isActive : true} className="size-4 accent-forest" />
              Show on the website
            </label>
          </>
        )}
      </div>

      {row && row.placeholderFields.length > 0 && (
        <label className="flex items-start gap-2 border-l-4 border-warning bg-warning/5 p-3 text-sm text-charcoal">
          <input type="checkbox" name="markReviewed" className="mt-0.5 size-4 accent-forest" />
          <span>
            <strong>I have reviewed this and it is final.</strong> Tick this to remove the placeholder flag
            ({row.placeholderFields.join(", ")}) without changing the text. Editing a flagged field also clears its flag.
          </span>
        </label>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : row ? "Save changes" : `Add ${collection.singular}`}
      </Button>
    </form>
  );
}
