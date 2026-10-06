"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select } from "@/components/ui/form";
import { INVENTORY_UNITS } from "@/config/inventory";
import type { ActionResult } from "@/lib/actions";
import { createItem, updateItem } from "./actions";

export type ItemValues = {
  id: string;
  name: string;
  category: string;
  unit: string;
  lowStockThreshold: string;
  unitCostNpr: number | null;
  supplier: string | null;
  /** The unit is locked once any stock has been recorded. */
  hasMovements: boolean;
};

/** Create (no `item`) or edit an inventory item. Quantity is never edited here: movements change it. */
export function ItemForm({ item, categories }: { item?: ItemValues; categories: string[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(item ? updateItem : createItem, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string, hint = false) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `item-${name}-error` : hint ? `item-${name}-hint` : undefined,
  });

  return (
    <form action={action} className="space-y-4" noValidate>
      {item && <input type="hidden" name="itemId" value={item.id} />}
      <ActionMessage result={result} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="item-name" label="Name" error={errors?.name}>
          <Input id="item-name" name="name" required maxLength={80} defaultValue={item?.name} {...a11y("name")} />
        </Field>
        <Field id="item-category" label="Category" error={errors?.category} hint="Pick one or type a new category.">
          <Input
            id="item-category"
            name="category"
            required
            maxLength={40}
            list="item-category-options"
            defaultValue={item?.category}
            {...a11y("category", true)}
          />
          <datalist id="item-category-options">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="item-unit"
          label="Unit"
          error={errors?.unit}
          hint={item?.hasMovements ? "Locked: stock has been recorded." : "pcs, box and pack are whole numbers only."}
        >
          {item?.hasMovements && <input type="hidden" name="unit" value={item.unit} />}
          <Select
            id="item-unit"
            name={item?.hasMovements ? undefined : "unit"}
            required
            defaultValue={item?.unit ?? ""}
            disabled={item?.hasMovements}
            {...a11y("unit", true)}
          >
            {!item && <option value="">Choose…</option>}
            {INVENTORY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="item-threshold"
          label="Low-stock threshold"
          error={errors?.lowStockThreshold}
          hint="Alert at or below this amount. 0 means never alert."
        >
          <Input
            id="item-threshold"
            name="lowStockThreshold"
            inputMode="decimal"
            defaultValue={item?.lowStockThreshold ?? "0"}
            {...a11y("lowStockThreshold", true)}
          />
        </Field>
        {!item && (
          <Field
            id="item-opening"
            label="Opening quantity"
            error={errors?.openingQuantity}
            hint="What is on the shelf now. Recorded as the first movement."
          >
            <Input id="item-opening" name="openingQuantity" inputMode="decimal" defaultValue="0" {...a11y("openingQuantity", true)} />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="item-cost" label="Unit cost (NPR, optional)" error={errors?.unitCostNpr} hint="Whole rupees per unit.">
          <Input
            id="item-cost"
            name="unitCostNpr"
            inputMode="numeric"
            defaultValue={item?.unitCostNpr ?? ""}
            {...a11y("unitCostNpr", true)}
          />
        </Field>
        <Field id="item-supplier" label="Supplier (optional)" error={errors?.supplier}>
          <Input id="item-supplier" name="supplier" maxLength={80} defaultValue={item?.supplier ?? ""} {...a11y("supplier")} />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : item ? "Save changes" : "Add item"}
      </Button>
    </form>
  );
}
