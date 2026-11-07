import { profileStore } from "../shared/profileStore";
import { startPicker } from "./picker";

type PickerWindow = Window & { __jobAutofillStopPicker?: () => void };

const w = window as PickerWindow;

if (w.__jobAutofillStopPicker) {
  w.__jobAutofillStopPicker();
} else {
  w.__jobAutofillStopPicker = startPicker(document, {
    saveAnswer: (question, answer) => profileStore.upsertAnswer(question, answer),
    onStop: () => {
      w.__jobAutofillStopPicker = undefined;
    },
  });
}
