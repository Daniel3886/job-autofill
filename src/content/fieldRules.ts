export type TextFieldId = "firstName" | "lastName" | "email" | "phone" | "city" | "salary";

export interface FieldRule {
  id: TextFieldId;
  autocomplete: string[];
  inputTypes: string[];
  keywords: string[];
  attrKeywords: string[];
}

export const SALARY_KEYWORDS = [
  "salary",
  "expected salary",
  "salary expectations",
  "compensation",
  "wynagrodzenie",
  "oczekiwania finansowe",
  "stawka",
];

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
    keywords: ["city", "town", "location", "miasto", "miejscowosc", "lokalizacja"],
    attrKeywords: [],
  },
  {
    id: "salary",
    autocomplete: [],
    inputTypes: [],
    keywords: SALARY_KEYWORDS,
    attrKeywords: [],
  },
];
