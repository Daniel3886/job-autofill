import { profileStore } from "../shared/profileStore";
import type { FillResultMessage, MainWorldRequest, SelectizeInfo } from "../shared/messages";
import { fillDocument } from "./fill";
import type { FileSource, MainWorldBridge } from "./plan";
import { showProgress, showReport } from "./report";

const bridge: MainWorldBridge = {
  async readSelectize(targets) {
    const req: MainWorldRequest = { type: "main-world", op: "readSelectize", targets };
    const res = (await chrome.runtime.sendMessage(req)) as Record<string, SelectizeInfo | null> | null;
    return res ?? {};
  },
  async setSelectize(items) {
    const req: MainWorldRequest = { type: "main-world", op: "setSelectize", items };
    const res = (await chrome.runtime.sendMessage(req)) as number | null;
    return typeof res === "number" ? res : 0;
  },
  async searchSelectize(target, query) {
    const req: MainWorldRequest = { type: "main-world", op: "searchSelectize", target, query };
    return ((await chrome.runtime.sendMessage(req)) as SelectizeInfo | null) ?? null;
  },
};

const files: FileSource = { loadCv: () => profileStore.getCv() };

async function run() {
  const [profile, answers] = await Promise.all([profileStore.getActive(), profileStore.getAnswers()]);
  const { filled, leftovers } = await fillDocument(document, {
    profile,
    answers,
    bridge,
    files,
    checkVisibility: true,
    onProgress: (message) => showProgress(message),
  });

  try {
    showReport(leftovers);
  } catch (err) {
    console.warn("Job Autofill: could not list the fields left to fill", err);
  }

  const result: FillResultMessage = { type: "fill-result", filled };
  await chrome.runtime.sendMessage(result);
}

void run();
