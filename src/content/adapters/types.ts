import type { TextFieldId } from "../fieldRules";
import type { TextLike } from "../signals";

// What an adapter hands to the rest of the extension: "this element answers
// this field". Adapters only identify fields; drivers do the filling.
export type FieldTarget =
  | { kind: "text"; fieldId: TextFieldId; question: string; element: TextLike }
  | { kind: "select"; fieldId: string; question: string; element: HTMLSelectElement }
  | { kind: "radio"; fieldId: string; question: string; radios: HTMLInputElement[] }
  | { kind: "file"; fieldId: "cv"; question: string; element: HTMLInputElement };

export interface CollectContext {
  checkVisibility: boolean;
  // Elements an earlier adapter already handled or deliberately skipped.
  // Later adapters (the generic fallback) must leave them alone.
  claimed: Set<Element>;
  // Fields an earlier adapter already found, so they are not filled twice.
  claimedFields: Set<string>;
}

export interface VendorAdapter {
  id: string;
  detect(doc: Document): boolean;
  collect(doc: Document, ctx: CollectContext): FieldTarget[];
}
