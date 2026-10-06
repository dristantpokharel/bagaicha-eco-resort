import { whatsappUrl } from "@/lib/booking/phone";

/** Phone number with tap-to-call and a WhatsApp link. */
export function ContactPhone({ phone }: { phone: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <a href={`tel:${phone}`} className="underline-offset-2 hover:underline">
        {phone}
      </a>
      <a
        href={whatsappUrl(phone)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-success underline-offset-2 hover:underline"
        aria-label={`WhatsApp ${phone} (opens in a new tab)`}
      >
        WhatsApp
      </a>
    </span>
  );
}
