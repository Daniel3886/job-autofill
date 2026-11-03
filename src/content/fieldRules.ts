import type { BuiltInFieldId } from "../shared/profile";

// How to recognise each profile field on a page.
// keywords: matched against visible text (label, aria-label, placeholder, nearby text)
//           and against name/id attributes. Write them in plain lowercase ASCII
//           (no Polish diacritics) because text is normalised the same way.
// attrKeywords: extra tokens that only make sense inside name/id attributes.
export interface FieldRule {
  id: BuiltInFieldId;
  autocomplete: string[];
  inputTypes: string[];
  keywords: string[];
  attrKeywords: string[];
}

export const FIELD_RULES: FieldRule[] = [
  {
    id: "firstName",
    autocomplete: ["given-name"],
    inputTypes: [],
    keywords: ["first name", "given name", "forename", "imie"],
    attrKeywords: ["fname", "firstname", "givenname"],
  },
  {
    id: "lastName",
    autocomplete: ["family-name"],
    inputTypes: [],
    keywords: ["last name", "surname", "family name", "nazwisko"],
    attrKeywords: ["lname", "lastname", "familyname"],
  },
  {
    id: "email",
    autocomplete: ["email"],
    inputTypes: ["email"],
    keywords: ["email", "e mail", "mail", "adres email"],
    attrKeywords: [],
  },
  {
    id: "phone",
    autocomplete: ["tel", "tel-national", "tel-local"],
    inputTypes: ["tel"],
    keywords: ["phone", "telephone", "mobile", "phone number", "telefon", "numer telefonu", "komorka"],
    attrKeywords: ["tel", "phonenumber", "mobilephone"],
  },
  {
    id: "city",
    autocomplete: ["address-level2"],
    inputTypes: [],
    keywords: ["city", "town", "miasto", "miejscowosc"],
    attrKeywords: [],
  },
  {
    id: "salary",
    autocomplete: [],
    inputTypes: [],
    keywords: [
      "salary",
      "expected salary",
      "salary expectations",
      "compensation",
      "wynagrodzenie",
      "oczekiwania finansowe",
      "stawka",
    ],
    attrKeywords: [],
  },
];
