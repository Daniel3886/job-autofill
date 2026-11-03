import { profileStore } from "../shared/profileStore";
import type { FillResultMessage } from "../shared/messages";
import { collectFillableInputs, setInputValue } from "./fill";
import { matchInputs } from "./matcher";

// Injected into the active tab on each icon click.
async function run() {
  const profile = await profileStore.get();
  const matches = matchInputs(collectFillableInputs(document));

  let filled = 0;
  for (const { input, fieldId } of matches) {
    const value = profile.values[fieldId]?.trim();
    if (!value) continue;
    setInputValue(input, value);
    filled++;
  }

  const result: FillResultMessage = { type: "fill-result", filled };
  await chrome.runtime.sendMessage(result);
}

void run();
