import { genericAdapter } from "./generic";
import { traffitAdapter } from "./traffit";
import type { CollectContext, FieldTarget, VendorAdapter } from "./types";

// Vendor adapters, most specific first. Add a new ATS by writing an adapter
// and listing it here; nothing else changes.
export const VENDOR_ADAPTERS: VendorAdapter[] = [traffitAdapter];

// The first vendor adapter that recognises the page runs, then the generic
// adapter picks up whatever it did not claim.
export function collectTargets(doc: Document, checkVisibility = true): FieldTarget[] {
  const ctx: CollectContext = { checkVisibility, claimed: new Set(), claimedFields: new Set() };
  const targets: FieldTarget[] = [];
  const vendor = VENDOR_ADAPTERS.find((a) => a.detect(doc));
  if (vendor) targets.push(...vendor.collect(doc, ctx));
  targets.push(...genericAdapter.collect(doc, ctx));
  return targets;
}
