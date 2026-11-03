import { classifyQuestion } from "../choices/choiceRules";
import { isFillableText } from "../drivers/text";
import type { TextFieldId } from "../fieldRules";
import type { TextLike } from "../signals";
import { normalize } from "../text";
import type { FieldTarget, VendorAdapter } from "./types";

// Traffit ATS public forms (*.traffit.com/public/form/...).
// Text fields carry a stable data-sid; dropdowns are hidden <select>s wrapped
// by Selectize.js, each inside a .form-group with its <label>.

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
      // Country and city options are fetched from Traffit's server as you type.
      // Not supported yet.
      if (select.classList.contains("location-select")) continue;

      const label = select.closest(".form-group")?.querySelector("label");
      const question = normalize(label?.textContent ?? "");
      const fieldId = classifyQuestion(question);
      if (!fieldId) continue;
      ctx.claimedFields.add(fieldId);
      targets.push({ kind: "select", fieldId, question, element: select });
    }

    return targets;
  },
};
