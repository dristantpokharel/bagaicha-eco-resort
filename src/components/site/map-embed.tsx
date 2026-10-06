"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Google Maps embed (no API key). Nothing is requested from Google until the
 * visitor chooses to show the map.
 */
export function MapEmbed({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-ink-heading" })}>
        Show map
      </button>
    );
  }
  return (
    <iframe
      title={title}
      src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="aspect-[4/3] w-full border-0 bg-sage"
      allowFullScreen
    />
  );
}
