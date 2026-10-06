"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { createRoomType, updateRoomType } from "./actions";

export type RoomTypeValues = {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePriceNpr: number;
  childPricePerNightNpr: number;
  maxGuests: number;
  amenities: string[];
  sortOrder: number;
};

/** Create (no `roomType`) or edit a room type. */
export function RoomTypeForm({ roomType }: { roomType?: RoomTypeValues }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    roomType ? updateRoomType : createRoomType,
    null,
  );
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string, hint = false) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `rt-${name}-error` : hint ? `rt-${name}-hint` : undefined,
  });

  return (
    <form action={action} className="space-y-4" noValidate>
      {roomType && <input type="hidden" name="roomTypeId" value={roomType.id} />}
      <ActionMessage result={result} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rt-name" label="Name" error={errors?.name}>
          <Input id="rt-name" name="name" required maxLength={80} defaultValue={roomType?.name} {...a11y("name")} />
        </Field>
        <Field
          id="rt-slug"
          label="URL slug"
          error={errors?.slug}
          hint="Used in the page address. Leave blank to make one from the name."
        >
          <Input
            id="rt-slug"
            name="slug"
            maxLength={80}
            defaultValue={roomType?.slug}
            placeholder="e.g. family-room"
            {...a11y("slug", true)}
          />
        </Field>
      </div>

      <Field id="rt-description" label="Description" error={errors?.description}>
        <Textarea
          id="rt-description"
          name="description"
          rows={4}
          required
          maxLength={2000}
          defaultValue={roomType?.description}
          {...a11y("description")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          id="rt-price"
          label="Price per night (NPR)"
          error={errors?.basePriceNpr}
          hint="Whole rupees. Existing bookings keep their own price."
        >
          <Input
            id="rt-price"
            name="basePriceNpr"
            inputMode="numeric"
            required
            defaultValue={roomType?.basePriceNpr}
            {...a11y("basePriceNpr", true)}
          />
        </Field>
        <Field
          id="rt-child-price"
          label="Per child under 8 (NPR/night)"
          error={errors?.childPricePerNightNpr}
          hint="Added per child per night. 0 = free."
        >
          <Input
            id="rt-child-price"
            name="childPricePerNightNpr"
            inputMode="numeric"
            defaultValue={roomType?.childPricePerNightNpr ?? 0}
            {...a11y("childPricePerNightNpr", true)}
          />
        </Field>
        <Field id="rt-guests" label="Maximum guests" error={errors?.maxGuests}>
          <Input
            id="rt-guests"
            name="maxGuests"
            type="number"
            min={1}
            max={20}
            required
            defaultValue={roomType?.maxGuests ?? 2}
            {...a11y("maxGuests")}
          />
        </Field>
        <Field id="rt-sort" label="Display order" error={errors?.sortOrder} hint="Lower numbers show first.">
          <Input
            id="rt-sort"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={roomType?.sortOrder ?? 0}
            {...a11y("sortOrder", true)}
          />
        </Field>
      </div>

      <Field id="rt-amenities" label="Amenities" error={errors?.amenities} hint="One per line.">
        <Textarea
          id="rt-amenities"
          name="amenities"
          rows={5}
          defaultValue={roomType?.amenities.join("\n")}
          {...a11y("amenities", true)}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : roomType ? "Save changes" : "Create room type"}
      </Button>
    </form>
  );
}
