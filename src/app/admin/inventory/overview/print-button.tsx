"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" size="sm" className="min-h-11 print:hidden" onClick={() => window.print()}>
      Print
    </Button>
  );
}
