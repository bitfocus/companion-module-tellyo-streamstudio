import { CompanionOptionValues } from "@companion-module/base";
import { Feedback } from "./feedbacks";
import { ProjectState } from "./types/projectState";
import { getValueAtPath } from "./utils";

export const initProjectState: ProjectState = {
    monitoredAudio: "preview",
    directEditScene: false,
    directEditLayer: false,
    currentProgramSceneIndex: 0,
    currentPreviewSceneIndex: 0,
    currentPreviewSceneName: "",
    currentProgramSceneName: "",
    sceneNames: [],
    replaysPlaybackSpeed: 100,
    replaysSelectedSlot: "all",
    audioOutputs: {},
};

export const parametersTopicToProjectStateFieldMap: Record<string, string> = {
    "PlayAudio/channel": "monitoredAudio",
    "SetDirectEditScene/active": "directEditScene",
    "SetDirectEditLayer/active": "directEditLayer",
    "SetCurrentSceneByIndex/sceneIndex": "currentProgramSceneIndex",
    "SetPreviewSceneByIndex/sceneIndex": "currentPreviewSceneIndex",
    "replays.slot.playback.speed.select/speed_percent": "replaysPlaybackSpeed",
    "replays.slot.playback.speed/speed_percent": "replaysPlaybackSpeed",
    "replays.slot.select/slot": "replaysSelectedSlot",
};

export const parametersTopicToFeedbackNamesMap: Record<string, string[]> = {
    "PlayAudio/channel": [Feedback.MONITORED_AUDIO],
    "SetDirectEditScene/active": [Feedback.DIRECT_EDIT_SCENE],
    "SetDirectEditLayer/active": [Feedback.DIRECT_EDIT_LAYER],
    "SetCurrentSceneByIndex/sceneIndex": [Feedback.PROGRAM_SCENE_INDEX],
    "SetPreviewSceneByIndex/sceneIndex": [Feedback.PREVIEW_SCENE_INDEX],
    "replays.slot.playback.speed.select/speed_percent": [
        Feedback.REPLAYS_PLAYBACK_SPEED_PREDEFINED,
        Feedback.REPLAYS_PLAYBACK_SPEED,
    ],
    "replays.slot.playback.speed/speed_percent": [
        Feedback.REPLAYS_PLAYBACK_SPEED_PREDEFINED,
        Feedback.REPLAYS_PLAYBACK_SPEED,
    ],
    "replays.slot.select/slot": [Feedback.REPLAYS_SELECTED_SLOT],
};

export const getBooleanState = (parameterTopic: string, options: CompanionOptionValues, projectState: ProjectState) => {
    switch (parameterTopic) {
        case "audiomixer.output.muted/muted": {
            const outputFromState = projectState.audioOutputs[options["output"] as string];
            if (typeof outputFromState === "undefined") return false;
            return outputFromState.muted;
        }
        case "SetProgramMuted/muted": {
            const outputFromState = projectState.audioOutputs["Master"];
            if (typeof outputFromState === "undefined") return false;
            return outputFromState.muted;
        }
        default:
            return getValueAtPath(projectState, parametersTopicToProjectStateFieldMap[parameterTopic]);
    }
};
