import type { SavedAnswer } from "../../shared/answers";
import { normalizeQuestion } from "../../shared/text";
import { choiceQuestion, isChoiceEmpty, type ChoiceControl } from "../choiceControls";
import { queryAllDeep } from "../dom";
import { collectComboboxes } from "../drivers/combobox";
import { collectRadioGroups } from "../drivers/radio";
import { isSelectized } from "../drivers/select";
import { collectTextInputs } from "../drivers/text";
import { rawQuestionText } from "../signals";
import { isPersonFacing } from "../visibility";
import type { CollectContext, FieldTarget } from "./types";

/**
 * Saved answers for the fields on the page. They neither skip nor claim elements other adapters
 * matched: an element can also be a profile field, and the profile takes precedence when filling.
 */
export function collectSavedAnswers(doc: Document, ctx: CollectContext, answers: SavedAnswer[]): FieldTarget[] {
  const byQuestion = new Map(answers.map((a) => [normalizeQuestion(a.question), a.answer]));
  byQuestion.delete("");
  if (byQuestion.size === 0) return [];

  const targets: FieldTarget[] = [];
  for (const element of collectTextInputs(doc, ctx.checkVisibility)) {
    const value = byQuestion.get(normalizeQuestion(rawQuestionText(element)));
    if (value === undefined) continue;
    targets.push({ kind: "answer", element, value });
  }

  for (const control of choiceControls(doc, ctx.checkVisibility)) {
    const question = choiceQuestion(control);
    const value = byQuestion.get(normalizeQuestion(question));
    if (value !== undefined) targets.push({ kind: "choiceAnswer", control, question, value });
  }
  return targets;
}

/** Selects, radio groups and comboboxes a person sees and has not answered yet. */
function choiceControls(doc: Document, checkVisibility: boolean): ChoiceControl[] {
  const controls: ChoiceControl[] = [];
  for (const element of queryAllDeep<HTMLSelectElement>(doc, "select")) {
    // Selectize keeps its options in page JavaScript; only the profile's choices reach it.
    if (element.disabled || element.multiple || isSelectized(element)) continue;
    if (isPersonFacing(element, checkVisibility)) controls.push({ type: "select", element });
  }
  for (const group of collectRadioGroups(doc)) controls.push({ type: "radio", radios: group.radios });
  for (const element of collectComboboxes(doc)) {
    if (isPersonFacing(element, checkVisibility)) controls.push({ type: "combobox", element });
  }
  return controls.filter(isChoiceEmpty);
}
