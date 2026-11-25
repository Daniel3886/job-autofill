import type { SavedAnswer } from "../shared/answers";
import type { Profile } from "../shared/profile";
import { collectTargets, detectVendor } from "./adapters";
import { fillComboboxes } from "./comboboxes";
import { findLeftovers, type Leftover } from "./leftovers";
import { fillLocations } from "./location";
import { executeActions, planFills, type FileSource, type MainWorldBridge } from "./plan";
import { fillSearchBoxes } from "./searchBoxes";

export interface FillInput {
  profile: Profile;
  answers: SavedAnswer[];
  bridge: MainWorldBridge;
  files: FileSource;
  checkVisibility: boolean;
  /** Called while the fill waits on the page, with what to tell the person. */
  onProgress?(message: string): void;
}

export interface FillOutcome {
  filled: number;
  leftovers: Leftover[];
}

/** Everything one toolbar click does to a page, in order. */
export async function fillDocument(doc: Document, input: FillInput): Promise<FillOutcome> {
  const { profile, answers, bridge, files, checkVisibility } = input;
  const vendor = detectVendor(doc);
  const targets = collectTargets(doc, checkVisibility, answers);
  const actions = await planFills(targets, profile, bridge, files);
  const located = await fillLocations(targets, profile, bridge).catch((err) => {
    console.warn("Job Autofill: city fill failed", err);
    return 0;
  });
  const executed = await executeActions(actions, bridge);

  // A page that parses the uploaded CV writes into untouched fields; fill the rest after it.
  if (vendor?.settleAfterCv && actions.some((a) => a.kind === "file")) {
    if (vendor.settleMessage) input.onProgress?.(vendor.settleMessage);
    await vendor.settleAfterCv(doc).catch((err) => console.warn("Job Autofill: waiting for the CV to be read failed", err));
  }

  const picked = await fillComboboxes(targets, profile).catch((err) => {
    console.warn("Job Autofill: dropdown fill failed", err);
    return 0;
  });
  const searched = await fillSearchBoxes(targets, profile).catch((err) => {
    console.warn("Job Autofill: search box fill failed", err);
    return 0;
  });
  return { filled: located + executed + picked + searched, leftovers: findLeftovers(doc, checkVisibility) };
}
