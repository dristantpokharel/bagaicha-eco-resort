"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Input, Select } from "@/components/ui/form";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/schemas";
import type { ActionResult } from "@/lib/actions";
import type { Role } from "@/generated/prisma/enums";
import { changeRole, resetPassword, setActive } from "./actions";
import { ASSIGNABLE_ROLES } from "./schemas";

type Props = {
  user: { id: string; name: string; role: Role; isActive: boolean };
  isSelf: boolean;
};

export function UserRowActions({ user, isSelf }: Props) {
  const [roleResult, roleAction, rolePending] = useActionState<ActionResult | null, FormData>(changeRole, null);
  const [activeResult, activeAction, activePending] = useActionState<ActionResult | null, FormData>(setActive, null);
  const [resetResult, resetAction, resetPending] = useActionState<ActionResult | null, FormData>(resetPassword, null);
  const resetError = resetResult && !resetResult.ok ? resetResult.fieldErrors?.password : undefined;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {user.role !== "SUPERUSER" && (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <label htmlFor={`role-${user.id}`} className="sr-only">
              Role for {user.name}
            </label>
            <Select id={`role-${user.id}`} name="role" defaultValue={user.role} className="h-8 w-28">
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm" disabled={rolePending}>
              {rolePending ? "Saving…" : "Save role"}
            </Button>
          </form>
        )}

        {!isSelf && (
          <form action={activeAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="isActive" value={String(!user.isActive)} />
            <Button type="submit" variant={user.isActive ? "danger" : "secondary"} size="sm" disabled={activePending}>
              {activePending ? "Saving…" : user.isActive ? "Deactivate" : "Activate"}
            </Button>
          </form>
        )}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-sm text-forest underline-offset-2 hover:underline">
          Reset password
        </summary>
        <form action={resetAction} className="mt-2 flex flex-wrap items-start gap-2" noValidate>
          <input type="hidden" name="userId" value={user.id} />
          <label htmlFor={`reset-${user.id}`} className="sr-only">
            New password for {user.name}
          </label>
          <Input
            id={`reset-${user.id}`}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`}
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="h-8 w-60"
            aria-invalid={resetError ? true : undefined}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={resetPending}>
            {resetPending ? "Saving…" : "Set password"}
          </Button>
        </form>
        {resetError && <p className="mt-1 text-xs text-error">{resetError}</p>}
      </details>

      <ActionMessage result={roleResult} />
      <ActionMessage result={activeResult} />
      {!resetError && <ActionMessage result={resetResult} />}
    </div>
  );
}
