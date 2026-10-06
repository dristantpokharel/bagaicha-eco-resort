"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select } from "@/components/ui/form";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/schemas";
import type { ActionResult } from "@/lib/actions";
import { createUser } from "./actions";
import { ASSIGNABLE_ROLES } from "./schemas";

export function CreateUserForm() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createUser, null);
  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;
  const invalid = (name: string) => (fieldErrors?.[name] ? true : undefined);
  const describedBy = (name: string, hint = false) =>
    fieldErrors?.[name] ? `new-${name}-error` : hint ? `new-${name}-hint` : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <ActionMessage result={result} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="new-name" label="Name" error={fieldErrors?.name}>
          <Input id="new-name" name="name" required maxLength={100} aria-invalid={invalid("name")} aria-describedby={describedBy("name")} />
        </Field>
        <Field id="new-email" label="Email" error={fieldErrors?.email}>
          <Input id="new-email" name="email" type="email" required autoComplete="off" aria-invalid={invalid("email")} aria-describedby={describedBy("email")} />
        </Field>
        <Field id="new-role" label="Role" error={fieldErrors?.role}>
          <Select id="new-role" name="role" defaultValue="STAFF" aria-invalid={invalid("role")} aria-describedby={describedBy("role")}>
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="new-password"
          label="Initial password"
          error={fieldErrors?.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. Share it with the user privately.`}
        >
          <Input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            aria-invalid={invalid("password")}
            aria-describedby={describedBy("password", true)}
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add user"}
      </Button>
    </form>
  );
}
