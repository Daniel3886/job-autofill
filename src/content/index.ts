import { profileStore } from "../shared/profileStore";
import type { FillResultMessage, MainWorldRequest, SelectizeInfo } from "../shared/messages";
import { collectTargets } from "./adapters";
import { executeActions, planFills, type MainWorldBridge } from "./plan";

// Injected into the active tab on each icon click.

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
};

async function run() {
  const profile = await profileStore.get();
  const targets = collectTargets(document);
  const actions = await planFills(targets, profile, bridge);
  const filled = await executeActions(actions, bridge);

  const result: FillResultMessage = { type: "fill-result", filled };
  await chrome.runtime.sendMessage(result);
}

void run();
