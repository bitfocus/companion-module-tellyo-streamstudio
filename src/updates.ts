import { Feedback } from "./feedbacks";
import StreamStudioInstance from "./index";
import { UpdateWSMessage } from "./types/wsMessages";
import { getValueAtPath } from "./utils";

export const processUpdate = (message: UpdateWSMessage, ssInstance: StreamStudioInstance) => {
    switch (message["update-type"]) {
        case "PlayAudio": {
            ssInstance.projectState.monitoredAudio = getValueAtPath(message, "channel");
            ssInstance.checkFeedbacks(Feedback.MONITORED_AUDIO);
            break;
        }
        case "SetDirectEditScene": {
            const value = getValueAtPath(message, "active");
            ssInstance.projectState.directEditScene = value;
            ssInstance.checkFeedbacks(Feedback.DIRECT_EDIT_SCENE);
            break;
        }
        case "SetDirectEditLayer": {
            const value = getValueAtPath(message, "active");
            ssInstance.projectState.directEditLayer = value;
            ssInstance.checkFeedbacks(Feedback.DIRECT_EDIT_LAYER);
            break;
        }
        case "ProgramSceneChanged": {
            const value = getValueAtPath(message, "scene-name");
            const index = ssInstance.projectState.sceneNames.findIndex((scene) => scene === value);
            if (index === -1) {
                ssInstance.log(
                    "error",
                    `Failed to process ProgramSceneChanged update. There is no scene with name ${value}.`
                );
                break;
            }
            ssInstance.projectState.currentProgramSceneIndex = index;
            ssInstance.projectState.currentProgramSceneName = value;
            ssInstance.checkFeedbacks(Feedback.PROGRAM_SCENE_INDEX, Feedback.PROGRAM_SCENE_NAME);
            break;
        }
        case "PreviewSceneChanged": {
            const value = getValueAtPath(message, "scene-name");
            const index = ssInstance.projectState.sceneNames.findIndex((scene) => scene === value);
            if (index === -1) {
                ssInstance.log(
                    "error",
                    `Failed to process PreviewSceneChanged update. There is no scene with name ${value}.`
                );
                break;
            }
            ssInstance.projectState.currentPreviewSceneIndex = index;
            ssInstance.projectState.currentPreviewSceneName = value;
            ssInstance.checkFeedbacks(Feedback.PREVIEW_SCENE_INDEX, Feedback.PREVIEW_SCENE_NAME);
            break;
        }
        case "replays.slot.playback.speed": {
            ssInstance.projectState.replaysPlaybackSpeed = getValueAtPath(message, "speed_percent");
            ssInstance.checkFeedbacks(Feedback.REPLAYS_PLAYBACK_SPEED, Feedback.REPLAYS_PLAYBACK_SPEED_PREDEFINED);
            break;
        }
        case "replays.slot.select": {
            ssInstance.projectState.replaysSelectedSlot = getValueAtPath(message, "slot");
            ssInstance.checkFeedbacks(Feedback.REPLAYS_SELECTED_SLOT);
            break;
        }
        case "audiomixer.output.muted": {
            const output = getValueAtPath(message, "output");
            const outputFromState = ssInstance.projectState.audioOutputs[output];
            if (typeof outputFromState === "undefined") break;
            outputFromState.muted = getValueAtPath(message, "muted");
            ssInstance.checkFeedbacks(Feedback.AUDIO_OUTPUT_MUTED);
            break;
        }
    }
};
