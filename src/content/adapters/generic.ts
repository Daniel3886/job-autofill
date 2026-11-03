import { classifyQuestion } from "../choices/choiceRules";
import { collectRadioGroups } from "../drivers/radio";
import { isSelectized } from "../drivers/select";
import { collectTextInputs, isVisible } from "../drivers/text";
import { FIELD_RULES } from "../fieldRules";
import { matchInputs } from "../matcher";
import { questionText } from "../signals";
import type { FieldTarget, VendorAdapter } from "./types";

// Works on any page: scores text inputs (matcher.ts) and classifies selects
// and radio groups by their question text. Runs after a vendor adapter and
// ignores whatever that adapter claimed.
export const genericAdapter: VendorAdapter = {
  id: "generic",

  detect() {
    return true;
  },

  collect(doc, ctx) {
    const targets: FieldTarget[] = [];

    const rules = FIELD_RULES.filter((r) => !ctx.claimedFields.has(r.id));
    const inputs = collectTextInputs(doc, ctx.checkVisibility, ctx.claimed);
    for (const m of matchInputs(inputs, rules)) {
      targets.push({ kind: "text", fieldId: m.fieldId, question: m.question, element: m.element });
    }

    for (const select of doc.querySelectorAll("select")) {
      if (ctx.claimed.has(select) || select.disabled) continue;
      // Selectize hides the real select, so only check visibility for plain ones.
      if (ctx.checkVisibility && !isSelectized(select) && !isVisible(select)) continue;
      const question = questionText(select);
      const fieldId = classifyQuestion(question);
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

    return targets;
  },
};
