import { hasAnyValue } from "../shared/profile";
import { profileStore } from "../shared/profileStore";
import { isFillResult, isMainWorldRequest, type MainWorldRequest } from "../shared/messages";
import { readSelectizeInPage, setSelectizeInPage } from "./mainWorld";

const PICK_FIELD = "pick-field";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PICK_FIELD,
      title: "Pick a field and save an answer",
      contexts: ["action"],
    });
  });
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    void chrome.runtime.openOptionsPage();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === PICK_FIELD && tab?.id !== undefined) void startPicker(tab.id);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === PICK_FIELD && tab?.id !== undefined) void startPicker(tab.id);
});

async function startPicker(tabId: number) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["picker.js"] });
  } catch (err) {
    console.warn("Job Autofill: cannot pick fields on this page", err);
    await showBadge(tabId, "!", "#b00020");
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;

  const profile = await profileStore.get();
  const hasAnswers = (await profileStore.getAnswers()).length > 0;
  if (!hasAnyValue(profile) && !hasAnswers && !(await profileStore.hasCv())) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (err) {
    console.warn("Job Autofill: cannot run on this page", err);
    await showBadge(tab.id, "!", "#b00020");
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  if (isFillResult(msg)) {
    void showBadge(tabId, String(msg.filled), msg.filled > 0 ? "#1b7f3b" : "#666666");
    return;
  }

  if (isMainWorldRequest(msg)) {
    runInMainWorld(tabId, sender.frameId ?? 0, msg).then(sendResponse, (err) => {
      console.warn("Job Autofill: main world call failed", err);
      sendResponse(null);
    });
    return true;
  }
});

async function runInMainWorld(tabId: number, frameId: number, msg: MainWorldRequest) {
  const target = { tabId, frameIds: [frameId] };
  if (msg.op === "readSelectize") {
    const [res] = await chrome.scripting.executeScript({
      target,
      world: "MAIN",
      func: readSelectizeInPage,
      args: [msg.targets],
    });
    return res?.result ?? {};
  }
  const [res] = await chrome.scripting.executeScript({
    target,
    world: "MAIN",
    func: setSelectizeInPage,
    args: [msg.items],
  });
  return res?.result ?? 0;
}

async function showBadge(tabId: number, text: string, color: string) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => void chrome.action.setBadgeText({ tabId, text: "" }), 4000);
}
