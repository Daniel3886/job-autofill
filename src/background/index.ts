import { hasAnyValue } from "../shared/profile";
import { profileStore } from "../shared/profileStore";
import { isFillResult } from "../shared/messages";

// First install: open the options page so the user can enter a profile.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    void chrome.runtime.openOptionsPage();
  }
});

// Icon click. activeTab grants access to this one tab for this click only,
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

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (!isFillResult(msg) || tabId === undefined) return;
  void showBadge(tabId, String(msg.filled), msg.filled > 0 ? "#1b7f3b" : "#666666");
});

async function showBadge(tabId: number, text: string, color: string) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => void chrome.action.setBadgeText({ tabId, text: "" }), 4000);
}
