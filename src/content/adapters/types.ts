import type { TextFieldId } from "../fieldRules";
import type { TextLike } from "../signals";

export type FieldTarget =
  | { kind: "text"; fieldId: TextFieldId; question: string; element: TextLike }
  | { kind: "select"; fieldId: string; question: string; element: HTMLSelectElement }
  | { kind: "radio"; fieldId: string; question: string; radios: HTMLInputElement[] }
  | { kind: "file"; fieldId: "cv"; question: string; element: HTMLInputElement }
  | { kind: "location"; fieldId: "city"; question: string; element: HTMLSelectElement };

export interface CollectContext {
  checkVisibility: boolean;
  claimed: Set<Element>;
  claimedFields: Set<string>;
}

export interface VendorAdapter {
  id: string;
  detect(doc: Document): boolean;
  collect(doc: Document, ctx: CollectContext): FieldTarget[];
}
