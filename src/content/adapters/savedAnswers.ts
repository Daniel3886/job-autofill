import type { SavedAnswer } from "../../shared/answers";
import { collectTextInputs } from "../drivers/text";
import { rawQuestionText } from "../signals";
import { normalizeQuestion } from "../../shared/text";
import type { CollectContext, FieldTarget } from "./types";

/**
 * Saved answers for the fields on the page. They neither skip nor claim elements other adapters
 * matched: an element can also be a profile field, and planFills gives the profile precedence.
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
  return targets;
}
