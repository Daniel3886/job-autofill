import { classifyQuestion } from "../choices/choiceRules";
import { isFillableText } from "../drivers/text";
import type { TextFieldId } from "../fieldRules";
import type { TextLike } from "../signals";
import { FIELD_RULES } from "../fieldRules";
import { containsPhrase, normalize } from "../text";
import type { FieldTarget, LocationFieldId, VendorAdapter } from "./types";

const SID_TO_FIELD: Record<string, TextFieldId> = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  mobile: "phone",
  phone: "phone",
};

const FORM = "form[name='dynamic_form']";

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
        const location = locationField(select, question);
        if (location && !ctx.claimedFields.has(location)) {
          ctx.claimedFields.add(location);
          targets.push({ kind: "location", fieldId: location, question, element: select });
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

const LOCATION_FIELDS: LocationFieldId[] = ["country", "city"];

function locationField(select: HTMLSelectElement, question: string): LocationFieldId | null {
  const byClass = LOCATION_FIELDS.find((id) => select.classList.contains(id));
  if (byClass) return byClass;
  return (
    LOCATION_FIELDS.find((id) =>
      FIELD_RULES.find((r) => r.id === id)?.keywords.some((k) => containsPhrase(question, k)),
    ) ?? null
  );
}
