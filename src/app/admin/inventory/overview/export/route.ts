import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { AuthorizationError } from "@/lib/auth/session";
import { loadOverview } from "@/lib/inventory/overview";
import { overviewCsv, parseOverviewTable } from "@/lib/inventory/overview-csv";
import { todayInResort } from "@/lib/dates";

/** Admin and up. `?table=to-buy|stock|rooms|losses` downloads that part of the overview as CSV. */
export async function GET(request: Request) {
  try {
    await requirePermission("inventory.overview");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new NextResponse("Not allowed.", { status: error.reason === "unauthenticated" ? 401 : 403 });
    }
    throw error;
  }
  const table = parseOverviewTable(new URL(request.url).searchParams.get("table"));
  if (!table) return new NextResponse("Unknown table.", { status: 400 });

  const csv = overviewCsv(table, await loadOverview());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${table}-${todayInResort().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
