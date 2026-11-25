import { classifyQuestion } from "../choices/choiceRules";
import { classifyPlaceQuestion } from "../choices/places";
import { queryAllDeep } from "../dom";
import { collectRadioGroups } from "../drivers/radio";
import { isSelectized } from "../drivers/select";
import { collectTextInputs } from "../drivers/text";
import { dateFormat, isStartDateQuestion } from "../dates";
import { FIELD_RULES } from "../fieldRules";
import { matchInputs } from "../matcher";
import { isCvQuestion } from "../fileRules";
import { questionText } from "../signals";
import { normalize } from "../text";
import { isHiddenByMarkup, isHoneypot, isPersonFacing } from "../visibility";
import type { FieldTarget, VendorAdapter } from "./types";

export const genericAdapter: VendorAdapter = {
  id: "generic",

  detect() {
    return true;
  },

  collect(doc, ctx) {
    const targets: FieldTarget[] = [];

    const rules = FIELD_RULES.filter((r) => !ctx.claimedFields.has(r.id));
    const inputs = collectTextInputs(doc, ctx.checkVisibility, ctx.claimed);
    const matched = new Set<Element>();
    for (const m of matchInputs(inputs, rules)) {
      matched.add(m.element);
      targets.push({ kind: "text", fieldId: m.fieldId, question: m.question, element: m.element });
    }

    // Start-date boxes: a native date input, or a text box whose placeholder shows the format.
    for (const input of [...inputs, ...queryAllDeep<HTMLInputElement>(doc, 'input[type="date"]')]) {
      if (matched.has(input) || !(input instanceof HTMLInputElement) || ctx.claimed.has(input)) continue;
      const isNative = input.type === "date";
      if (isNative && (input.value !== "" || input.disabled || input.readOnly || !isPersonFacing(input, ctx.checkVisibility))) continue;
      const format = isNative ? "YYYY-MM-DD" : dateFormat(input.placeholder);
      const question = questionText(input);
      if (format && isStartDateQuestion(question)) targets.push({ kind: "date", question, element: input, format });
    }

    for (const select of queryAllDeep<HTMLSelectElement>(doc, "select")) {
      if (ctx.claimed.has(select) || select.disabled) continue;
      if (!isPersonFacing(select, ctx.checkVisibility && !isSelectized(select))) continue;
      const question = questionText(select);
      const fieldId = classifyQuestion(question) ?? classifyPlaceQuestion(question);
      if (fieldId && !ctx.claimedFields.has(fieldId)) {
        targets.push({ kind: "select", fieldId, question, element: select });
      }
    }

    for (const group of collectRadioGroups(doc, ctx.claimed)) {
      const fieldId = classifyQuestion(group.question);
      if (fieldId && !ctx.claimedFields.has(fieldId)) {
        targets.push({ kind: "radio", fieldId, question: group.question, radios: group.radios });
      }
    }

    if (!ctx.claimedFields.has("cv")) {
      for (const input of queryAllDeep<HTMLInputElement>(doc, 'input[type="file"]')) {
        if (ctx.claimed.has(input) || input.disabled || (input.files?.length ?? 0) > 0) continue;
        // Upload inputs are usually styled away behind a button, so only markup can hide them.
        if (isHoneypot(input) || isHiddenByMarkup(input)) continue;
        const question = questionText(input);
        const attrs = normalize(`${input.name} ${input.id}`);
        if (isCvQuestion(question) || (!question && isCvQuestion(attrs))) {
          targets.push({ kind: "file", fieldId: "cv", question, element: input });
          break;
        }
      }
    }

    return targets;
  },
};
