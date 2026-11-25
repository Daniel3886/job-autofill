import type { TextFieldId } from "../fieldRules";
import type { SearchBoxSpec } from "../drivers/searchBox";
import type { TextLike } from "../signals";

export type FieldTarget =
  | { kind: "text"; fieldId: TextFieldId; question: string; element: TextLike }
  | { kind: "select"; fieldId: string; question: string; element: HTMLSelectElement }
  | { kind: "radio"; fieldId: string; question: string; radios: HTMLInputElement[] }
  | { kind: "file"; fieldId: "cv"; question: string; element: HTMLInputElement }
  | { kind: "location"; fieldId: "city"; question: string; element: HTMLSelectElement }
  | { kind: "date"; question: string; element: HTMLInputElement; format: string }
  | { kind: "consent"; element: HTMLInputElement }
  | { kind: "combobox"; fieldId: string; question: string; element: HTMLElement }
  | { kind: "search"; fieldId: "city"; question: string; element: HTMLInputElement; spec: SearchBoxSpec }
  | { kind: "answer"; element: TextLike; value: string };

export interface CollectContext {
  checkVisibility: boolean;
  claimed: Set<Element>;
  claimedFields: Set<string>;
}

export interface VendorAdapter {
  id: string;
  detect(doc: Document): boolean;
  collect(doc: Document, ctx: CollectContext): FieldTarget[];
  /**
   * Some pages read an uploaded CV and write what they find into fields that look untouched.
   * Resolves once that is over, so fields filled after it are not overwritten.
   */
  settleAfterCv?(doc: Document): Promise<void>;
  /** What to tell the person while settleAfterCv runs. */
  settleMessage?: string;
}
