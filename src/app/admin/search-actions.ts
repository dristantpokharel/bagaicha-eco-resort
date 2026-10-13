"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { searchAdmin, type SearchGroup } from "@/lib/admin/search";

/**
 * Quick search for the admin header. It's a server action (POST), so the query never appears in a URL, and it
 * deliberately does not call logActivity: search terms can be guest names and phone numbers.
 */
export async function searchAdminAction(query: string): Promise<SearchGroup[]> {
  const user = await requireUser();
  if (typeof query !== "string") return [];
  return searchAdmin(db, user.role, query);
}
