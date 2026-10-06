import type { ActionResult } from "@/lib/actions";
import { FormMessage } from "./form";

/** Shows the outcome of a server action; only claims success when it succeeded. */
export function ActionMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <FormMessage type="success">{result.message}</FormMessage>
  ) : (
    <FormMessage type="error">{result.error}</FormMessage>
  );
}
