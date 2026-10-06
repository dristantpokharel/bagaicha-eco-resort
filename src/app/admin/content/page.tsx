import { db } from "@/lib/db";
import { ContentForm } from "./content-form";
import { toContentRow } from "./rows";

export const metadata = { title: "Business info" };

export default async function BusinessInfoPage() {
  const row = await db.businessInfo.findUnique({ where: { id: 1 } });
  if (!row) return <p className="text-sm text-charcoal-light">No business info yet. Run <code>npm run seed:content</code>.</p>;
  return (
    <section className="max-w-3xl rounded-md border border-forest/15 bg-white p-5">
      <p className="mb-4 text-sm text-charcoal-light">
        Phone, WhatsApp, email, address, social links and map details. The website header, footer, contact and location
        pages all read from here.
      </p>
      <ContentForm collection="business" row={toContentRow("business", row)} />
    </section>
  );
}
