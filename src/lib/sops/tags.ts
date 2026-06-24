// Fixed tag vocabularies. These mirror the DB CHECK constraints on knowledge_base
// (vehicle_tags, driver_status_tags) — keep them in sync if the constraints change.
// Products are not here: their vocabulary is crm.products, fetched per platform.

export const VEHICLE_TAGS = ["car", "bike"] as const;
export const DRIVER_STATUS_TAGS = ["new", "active", "churn", "archive"] as const;

export type VehicleTag = (typeof VEHICLE_TAGS)[number];
export type DriverStatusTag = (typeof DRIVER_STATUS_TAGS)[number];
