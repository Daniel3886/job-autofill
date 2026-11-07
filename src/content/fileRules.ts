import { words } from "./locales";
import { containsPhrase } from "./text";

const CV_KEYWORDS = words((l) => l.cv?.keywords);

const OTHER_DOCUMENTS = words((l) => l.cv?.otherDocuments);

export function isCvQuestion(question: string): boolean {
  return (
    CV_KEYWORDS.some((k) => containsPhrase(question, k)) &&
    !OTHER_DOCUMENTS.some((k) => containsPhrase(question, k))
  );
}
