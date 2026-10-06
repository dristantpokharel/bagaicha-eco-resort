import { whatsappHref } from "@/lib/content/contact";
import { WhatsAppIcon } from "./icons";

/** Floating chat shortcut. Hidden when no WhatsApp number is set. */
export function WhatsAppButton({ number }: { number: string | null }) {
  if (!number) return null;
  return (
    <a
      href={whatsappHref(number)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp (opens in a new tab)"
      className="fixed right-4 bottom-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-forest text-cream outline-2 outline-cream transition-colors hover:bg-olive focus-visible:outline-offset-2 focus-visible:outline-forest md:right-6 md:bottom-6"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
}
