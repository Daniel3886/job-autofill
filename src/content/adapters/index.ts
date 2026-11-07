import { genericAdapter } from "./generic";
import { traffitAdapter } from "./traffit";
import type { CollectContext, FieldTarget, VendorAdapter } from "./types";

export const VENDOR_ADAPTERS: VendorAdapter[] = [traffitAdapter];

export function collectTargets(doc: Document, checkVisibility = true): FieldTarget[] {
  const ctx: CollectContext = { checkVisibility, claimed: new Set(), claimedFields: new Set() };
  const targets: FieldTarget[] = [];
  const vendor = VENDOR_ADAPTERS.find((a) => a.detect(doc));
  if (vendor) targets.push(...vendor.collect(doc, ctx));
  targets.push(...genericAdapter.collect(doc, ctx));
  return targets;
}
