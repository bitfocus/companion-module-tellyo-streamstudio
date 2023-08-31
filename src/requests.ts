import { Feedback } from "./feedbacks";
import StreamStudioInstance from "./index";
import { RequestType } from "./types/requests";
import { UpdateWSMessage } from "./types/wsMessages";
import { getValueAtPath } from "./utils";

export const processRequest = (message: UpdateWSMessage, requestType: string, ssInstance: StreamStudioInstance) => {
    switch (requestType) {
        case RequestType.GET_AUDIO_MIXER_STATE: {
            ssInstance.projectState.monitoredAudio = getValueAtPath(message, "monitoringChannel");
            ssInstance.checkFeedbacks(Feedback.MONITORED_AUDIO);
            break;
        }
        case RequestType.GET_DIRECT_EDIT: {
            const directEdit = getValueAtPath(message, "directEdit");
            ssInstance.projectState.directEditLayer = directEdit === "LAYER";
            ssInstance.projectState.directEditScene = directEdit === "SCENE";
            ssInstance.checkFeedbacks(Feedback.DIRECT_EDIT_LAYER, Feedback.DIRECT_EDIT_SCENE);
            break;
        }
        case RequestType.GET_LATEST_PROJECT: {
            const currentProgramSceneIndex = getValueAtPath(message, "update.producer.currentScene");
            const currentPreviewSceneIndex = getValueAtPath(message, "update.producer.previewScene");
            ssInstance.projectState.currentProgramSceneIndex = currentProgramSceneIndex;
            ssInstance.projectState.currentPreviewSceneIndex = currentPreviewSceneIndex;
            const scenes = getValueAtPath(message, "update.producer.scenes");
            ssInstance.projectState.currentPreviewSceneName = scenes[currentPreviewSceneIndex].name;
            ssInstance.projectState.currentProgramSceneName = scenes[currentProgramSceneIndex].name;
            ssInstance.projectState.sceneNames = getValueAtPath(message, "update.producer.scenes").map(
                (scene: any) => scene.name
            );
            ssInstance.checkFeedbacks(
                Feedback.PREVIEW_SCENE_INDEX,
                Feedback.PREVIEW_SCENE_NAME,
                Feedback.PROGRAM_SCENE_INDEX,
                Feedback.PROGRAM_SCENE_NAME
            );

            ssInstance.projectState.replaysPlaybackSpeed = getValueAtPath(message, "update.replay.motionSpeed");
            ssInstance.projectState.replaysSelectedSlot = getValueAtPath(message, "update.replay.activeSlot");
            ssInstance.checkFeedbacks(
                Feedback.REPLAYS_PLAYBACK_SPEED_PREDEFINED,
                Feedback.REPLAYS_PLAYBACK_SPEED,
                Feedback.REPLAYS_SELECTED_SLOT
            );
            break;
        }
        case RequestType.AUDIOMIXER_OUTPUT_MUTED: {
            const name = getValueAtPath(message, "name");
            let outputFromState = ssInstance.projectState.audioOutputs[name];
            if (typeof outputFromState === "undefined") {
                outputFromState = {
                    muted: false,
                };
                ssInstance.projectState.audioOutputs[name] = outputFromState;
            }
            outputFromState.muted === getValueAtPath(message, "mixer.mutted");
            ssInstance.checkFeedbacks(Feedback.AUDIO_OUTPUT_MUTED);
        }
    }
};
