import { hasAnyValue } from "../shared/profile";
import { profileStore } from "../shared/profileStore";
import {
  PROFILE_MENU_PREFIX,
  activeProfile,
  nextProfileId,
  profileBadge,
  profileMenuItems,
  type ProfilesState,
} from "../shared/profiles";
import { isFillResult, isMainWorldRequest, type MainWorldRequest } from "../shared/messages";
import { readSelectizeInPage, searchSelectizeInPage, setSelectizeInPage } from "./mainWorld";

const PICK_FIELD = "pick-field";
const NEXT_PROFILE = "next-profile";
const PROFILES_MENU = "profiles";
const TITLE = "Autofill this form";

// Menu rebuilds run one after another, so two quick profile changes never create an id twice.
let menuQueue: Promise<void> = Promise.resolve();

function refreshMenus(): Promise<void> {
  menuQueue = menuQueue
    .then(rebuildMenus)
    .catch((err) => console.warn("Job Autofill: could not update the profile menu", err));
  return menuQueue;
}

async function rebuildMenus(): Promise<void> {
  const state = await profileStore.getProfiles();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: PICK_FIELD, title: "Pick a field and save an answer", contexts: ["action"] });
  chrome.contextMenus.create({ id: PROFILES_MENU, title: "Fill with profile", contexts: ["action"] });
  for (const item of profileMenuItems(state)) {
    chrome.contextMenus.create({
      id: item.id,
      parentId: PROFILES_MENU,
      title: item.title,
      type: "radio",
      checked: item.checked,
      contexts: ["action"],
    });
  }
  await showProfileInTitle(state);
}

async function showProfileInTitle(state: ProfilesState): Promise<void> {
  const active = activeProfile(state);
  await chrome.action.setTitle({ title: active ? `${TITLE} — ${active.name}` : TITLE });
}

/** Shows the new profile's first letters on the icon for a moment, so a switch is never silent. */
async function flashProfile(state: ProfilesState): Promise<void> {
  const active = activeProfile(state);
  if (!active) return;
  await chrome.action.setBadgeBackgroundColor({ color: "#1b5fd1" });
  await chrome.action.setBadgeText({ text: profileBadge(active.name) });
  setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 2000);
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  void refreshMenus();
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    void chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(() => void refreshMenus());

chrome.storage.onChanged.addListener((changes, area) => {
  const change = changes.profiles;
  if (area !== "local" || !change) return;
  void refreshMenus();
  const before = change.oldValue as ProfilesState | undefined;
  const after = change.newValue as ProfilesState | undefined;
  if (before && after && before.activeId !== after.activeId) void flashProfile(after);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = String(info.menuItemId);
  if (id === PICK_FIELD && tab?.id !== undefined) void startPicker(tab.id);
  else if (id.startsWith(PROFILE_MENU_PREFIX)) void profileStore.setActive(id.slice(PROFILE_MENU_PREFIX.length));
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === PICK_FIELD && tab?.id !== undefined) void startPicker(tab.id);
  else if (command === NEXT_PROFILE) void switchToNextProfile();
});

/** The shortcut: with one profile there is nothing to switch to, so it just shows which one fills. */
async function switchToNextProfile(): Promise<void> {
  const state = await profileStore.getProfiles();
  if (state.list.length < 2) await flashProfile(state);
  else await profileStore.setActive(nextProfileId(state));
}

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

  const profile = await profileStore.getActive();
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
  if (msg.op === "searchSelectize") {
    const [res] = await chrome.scripting.executeScript({
      target,
      world: "MAIN",
      func: searchSelectizeInPage,
      args: [msg.target, msg.query],
    });
    return res?.result ?? null;
  }
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
