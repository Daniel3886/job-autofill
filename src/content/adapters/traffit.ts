import { classifyQuestion } from "../choices/choiceRules";
import { isFillableText } from "../drivers/text";
import type { TextFieldId } from "../fieldRules";
import type { TextLike } from "../signals";
import { FIELD_RULES } from "../fieldRules";
import { containsPhrase, normalize } from "../text";
import type { FieldTarget, VendorAdapter } from "./types";

const SID_TO_FIELD: Record<string, TextFieldId> = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  mobile: "phone",
  phone: "phone",
};

const FORM = "form[name='dynamic_form']";

const CITY_KEYWORDS = FIELD_RULES.find((r) => r.id === "city")?.keywords ?? [];

export const traffitAdapter: VendorAdapter = {
  id: "traffit",

  detect(doc) {
    if (!doc.querySelector(FORM)) return false;
    const host = doc.location?.hostname ?? "";
    return host.endsWith(".traffit.com") || doc.querySelector(".traffit-public-form") !== null;
  },

  collect(doc, ctx) {
    const targets: FieldTarget[] = [];

    for (const el of doc.querySelectorAll<TextLike>(`${FORM} input[data-sid], ${FORM} textarea[data-sid]`)) {
      const fieldId = SID_TO_FIELD[el.dataset.sid ?? ""];
      if (!fieldId) continue;
      ctx.claimed.add(el);
      ctx.claimedFields.add(fieldId);
      if (isFillableText(el, ctx.checkVisibility)) {
        targets.push({ kind: "text", fieldId, question: "", element: el });
      }
    }

    for (const select of doc.querySelectorAll<HTMLSelectElement>(`${FORM} select`)) {
      ctx.claimed.add(select);
      const label = select.closest(".form-group")?.querySelector("label");
      const question = normalize(label?.textContent ?? "");

      if (select.classList.contains("location-select")) {
        if (isCitySelect(select, question) && !ctx.claimedFields.has("city")) {
          ctx.claimedFields.add("city");
          targets.push({ kind: "location", fieldId: "city", question, element: select });
        }
        continue;
      }

      const fieldId = classifyQuestion(question);
      if (!fieldId) continue;
      ctx.claimedFields.add(fieldId);
      targets.push({ kind: "select", fieldId, question, element: select });
    }

    return targets;
  },
};

function isCitySelect(select: HTMLSelectElement, question: string): boolean {
  if (select.classList.contains("city")) return true;
  if (select.classList.contains("country")) return false;
  return CITY_KEYWORDS.some((k) => containsPhrase(question, k));
}
