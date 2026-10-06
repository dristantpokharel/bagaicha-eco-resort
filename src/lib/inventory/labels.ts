import type { StockMovementType } from "@/generated/prisma/enums";

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  RECEIVED: "Received",
  USED: "Used",
  ADJUSTED: "Adjusted",
};
