import { Feedback } from "./feedbacks";
import StreamStudioInstance from "./index";
import { parametersTopicToFeedbackNamesMap, parametersTopicToProjectStateFieldMap } from "./projectState";
import { ConfirmationWSMessage } from "./types/wsMessages";
import { getValueAtPath, setValueAtPath } from "./utils";

export const processConfirmation = (message: ConfirmationWSMessage, ssInstance: StreamStudioInstance) => {
    const confirmation = ssInstance.getAwaitedConfirmation(message["message-id"] as string);
    if (!confirmation) return;

    confirmation.parametersConfirmations.forEach((confirmation) => {
        switch (confirmation.topic) {
            case "audiomixer.output.muted/muted": {
                const output = getValueAtPath(message, "name");
                const outputFromState = ssInstance.projectState.audioOutputs[output];
                if (typeof outputFromState === "undefined") break;
                outputFromState.muted = confirmation.newValue as boolean;
                ssInstance.checkFeedbacks(Feedback.AUDIO_OUTPUT_MUTED);
                break;
            }
            case "SetCurrentSceneByIndex/sceneIndex":
            case "SetPreviewSceneByIndex/sceneIndex":
            default: {
                const pathInProjectState = parametersTopicToProjectStateFieldMap[confirmation.topic];
                if (typeof pathInProjectState === "undefined") return;
                setValueAtPath(ssInstance.projectState, confirmation.newValue, pathInProjectState);

                const feedbacks = parametersTopicToFeedbackNamesMap[confirmation.topic];
                ssInstance.checkFeedbacks(...feedbacks);
                break;
            }
        }
    });
};
