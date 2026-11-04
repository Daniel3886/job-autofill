import { containsPhrase } from "./text";

// Which file inputs ask for a CV. Normalised phrases, like fieldRules.ts.
const CV_KEYWORDS = ["cv", "resume", "curriculum vitae", "zyciorys"];

// Inputs for other documents. A question that mentions both ("CV / list
// motywacyjny") is skipped: better no upload than the wrong one.
const OTHER_DOCUMENTS = ["list motywacyjny", "cover letter", "motivation letter", "portfolio", "certyfikat", "certificate"];

export function isCvQuestion(question: string): boolean {
  return (
    CV_KEYWORDS.some((k) => containsPhrase(question, k)) &&
    !OTHER_DOCUMENTS.some((k) => containsPhrase(question, k))
  );
}
