import { hasAnyValue } from "../shared/profile";
import { profileStore } from "../shared/profileStore";
import { isFillResult, isMainWorldRequest, type MainWorldRequest } from "../shared/messages";
import { readSelectizeInPage, setSelectizeInPage } from "./mainWorld";

// First install: open the options page so the user can enter a profile.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    void chrome.runtime.openOptionsPage();
  }
});

// Icon click. activeTab grants access to this one tab until it navigates,
// so the extension never needs permission to read every site.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;

  const profile = await profileStore.get();
  if (!hasAnyValue(profile)) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (err) {
    // Chrome blocks injection into its own pages (chrome://, the Web Store).
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
    return true; // keep the channel open for the async response
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
