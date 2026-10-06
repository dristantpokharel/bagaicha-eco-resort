import type { BookingSource, BookingStatus, EnquiryStatus, EnquiryType } from "@/generated/prisma/enums";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
};

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  WEBSITE: "Website",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
  OTHER: "Other",
};

export const ENQUIRY_TYPE_LABELS: Record<EnquiryType, string> = {
  STAY: "Custom stay",
  EVENT: "Event",
  CONFERENCE: "Conference",
  OTHER: "Other",
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  CLOSED: "Closed",
};
