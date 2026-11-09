import type { SavedAnswer } from "../../shared/answers";
import { collectTextInputs } from "../drivers/text";
import { rawQuestionText } from "../signals";
import { normalizeQuestion } from "../../shared/text";
import type { CollectContext, FieldTarget } from "./types";

export function collectSavedAnswers(doc: Document, ctx: CollectContext, answers: SavedAnswer[]): FieldTarget[] {
  const byQuestion = new Map(answers.map((a) => [normalizeQuestion(a.question), a.answer]));
  byQuestion.delete("");
  if (byQuestion.size === 0) return [];

  const targets: FieldTarget[] = [];
  for (const element of collectTextInputs(doc, ctx.checkVisibility, ctx.claimed)) {
    const value = byQuestion.get(normalizeQuestion(rawQuestionText(element)));
    if (value === undefined) continue;
    ctx.claimed.add(element);
    targets.push({ kind: "answer", element, value });
  }
  return targets;
}
