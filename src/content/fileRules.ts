import { containsPhrase } from "./text";

const CV_KEYWORDS = ["cv", "resume", "curriculum vitae", "zyciorys"];

const OTHER_DOCUMENTS = ["list motywacyjny", "cover letter", "motivation letter", "portfolio", "certyfikat", "certificate"];

export function isCvQuestion(question: string): boolean {
  return (
    CV_KEYWORDS.some((k) => containsPhrase(question, k)) &&
    !OTHER_DOCUMENTS.some((k) => containsPhrase(question, k))
  );
}
