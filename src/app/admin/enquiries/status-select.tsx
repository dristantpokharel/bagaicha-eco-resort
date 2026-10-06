"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import type { EnquiryStatus } from "@/generated/prisma/enums";
import { ENQUIRY_STATUS_LABELS } from "@/lib/booking/labels";
import { setEnquiryStatus } from "./actions";

export function EnquiryStatusForm({ enquiryId, status }: { enquiryId: string; status: EnquiryStatus }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(setEnquiryStatus, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <Select name="status" defaultValue={status} aria-label="Enquiry status" className="w-auto">
        {Object.entries(ENQUIRY_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Update"}
      </Button>
      {result && (
        <span role={result.ok ? "status" : "alert"} className={`text-xs ${result.ok ? "text-success" : "text-error"}`}>
          {result.ok ? "Saved" : result.error}
        </span>
      )}
    </form>
  );
}
