"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input } from "@/components/ui/form";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/schemas";
import type { ActionResult } from "@/lib/actions";
import { changeOwnPassword, updateOwnName } from "./actions";

function useFieldHelpers(result: ActionResult | null, prefix: string) {
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  return {
    errors,
    a11y: (name: string, hint = false) => ({
      "aria-invalid": errors?.[name] ? true : undefined,
      "aria-describedby": errors?.[name] ? `${prefix}-${name}-error` : hint ? `${prefix}-${name}-hint` : undefined,
    }),
  };
}

export function NameForm({ name }: { name: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateOwnName, null);
  const { errors, a11y } = useFieldHelpers(result, "profile");
  return (
    <form action={action} className="space-y-4" noValidate>
      <ActionMessage result={result} />
      <div className="max-w-sm">
        <Field id="profile-name" label="Name" error={errors?.name}>
          <Input
            id="profile-name"
            name="name"
            defaultValue={name}
            maxLength={100}
            required
            autoComplete="name"
            {...a11y("name")}
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(changeOwnPassword, null);
  const { errors, a11y } = useFieldHelpers(result, "pw");
  return (
    <form action={action} className="space-y-4" noValidate>
      <ActionMessage result={result} />
      <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
        <Field id="pw-currentPassword" label="Current password" error={errors?.currentPassword}>
          <Input
            id="pw-currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            {...a11y("currentPassword")}
          />
        </Field>
        <Field
          id="pw-newPassword"
          label="New password"
          error={errors?.newPassword}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        >
          <Input
            id="pw-newPassword"
            name="newPassword"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            {...a11y("newPassword", true)}
          />
        </Field>
        <Field id="pw-confirmPassword" label="Confirm new password" error={errors?.confirmPassword}>
          <Input
            id="pw-confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            {...a11y("confirmPassword")}
          />
        </Field>
      </div>
      <p className="text-xs text-charcoal-light">You’ll be signed out everywhere and asked to sign in again.</p>
      <Button type="submit" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
