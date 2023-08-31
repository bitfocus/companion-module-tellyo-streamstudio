import { CompanionFeedbackDefinitions, DropdownChoice, combineRgb } from "@companion-module/base";
import StreamStudioInstance from "./index";
import { convertParamOptionsToChoices, getParameterTopic } from "./actions";
import { Options } from "./types/options";
import { RequestType } from "./types/requests";

const DEFAULT_CHOICE_ID = "default_option";

export enum Color {
    WHITE = combineRgb(255, 255, 255),
    BLACK = combineRgb(0, 0, 0),
    GREEN = combineRgb(0, 255, 0),
    RED = combineRgb(255, 0, 0),
    PURPLE = combineRgb(204, 0, 204),
}

export enum Feedback {
    MONITORED_AUDIO = "PlayAudio/channel",
    DIRECT_EDIT_SCENE = "SetDirectEditScene/active",
    DIRECT_EDIT_LAYER = "SetDirectEditLayer/active",
    PROGRAM_SCENE_INDEX = "ProgramSceneIndex/active",
    PREVIEW_SCENE_INDEX = "PreviewSceneIndex/active",
    PROGRAM_SCENE_NAME = "ProgramSceneName/active",
    PREVIEW_SCENE_NAME = "PreviewSceneName/active",
    REPLAYS_PLAYBACK_SPEED_PREDEFINED = "ReplaysPlaybackSpeedPredefined",
    REPLAYS_PLAYBACK_SPEED = "ReplaysPlaybackSpeed",
    REPLAYS_SELECTED_SLOT = "ReplaysSelectedSlot",
    AUDIO_OUTPUT_MUTED = "AudioOutputMuted",
}

const getChoices = (paramId: string, commandId: string, availableOptions: Options): DropdownChoice[] => {
    const topic = getParameterTopic(commandId, paramId);
    if (typeof availableOptions[topic] !== "undefined") return convertParamOptionsToChoices(availableOptions[topic]);
    return [{ id: 0, label: "No options available." }];
};

const generateFeedbacks = (ssInstance: StreamStudioInstance): CompanionFeedbackDefinitions => {
    const feedbacks: CompanionFeedbackDefinitions = {};

    feedbacks[Feedback.MONITORED_AUDIO] = {
        type: "boolean",
        name: "Video Mixer: Monitored audio (PREVIEW or PROGRAM)",
        defaultStyle: {
            bgcolor: Color.RED,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                label: "Monitored audio",
                choices: [
                    { id: "preview", label: "Preview" },
                    { id: "program", label: "Program" },
                ],
                id: "source",
                default: "preview",
            },
        ],
        callback: (feedback) => {
            const source = feedback.options["source"];
            return source === ssInstance.projectState.monitoredAudio;
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_AUDIO_MIXER_STATE);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "PlayAudio" });
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.DIRECT_EDIT_SCENE] = {
        type: "boolean",
        name: "Video Mixer: Direct Edit - Scenes (active)",
        defaultStyle: {
            bgcolor: Color.RED,
            color: Color.BLACK,
        },
        options: [],
        callback: (_feedback) => {
            return ssInstance.projectState.directEditScene;
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_DIRECT_EDIT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "SetDirectEditScene" });
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.DIRECT_EDIT_LAYER] = {
        type: "boolean",
        name: "Video Mixer: Direct Edit - Layers (active)",
        defaultStyle: {
            bgcolor: Color.RED,
            color: Color.BLACK,
        },
        options: [],
        callback: (_feedback) => {
            return ssInstance.projectState.directEditLayer;
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_DIRECT_EDIT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "SetDirectEditLayer" });
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.PROGRAM_SCENE_INDEX] = {
        type: "boolean",
        name: "Video Mixer: Program Scene by index (active)",
        defaultStyle: {
            bgcolor: Color.RED,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                id: "scene-index",
                label: "Scene index",
                choices: getChoices("sceneIndex", "SetCurrentSceneByIndex", ssInstance.options),
                default: DEFAULT_CHOICE_ID,
            },
        ],
        callback: (feedback) => {
            return ssInstance.projectState.currentProgramSceneIndex === feedback.options["scene-index"];
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_LATEST_PROJECT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "ProgramSceneChanged" });
            ssInstance.getOptions("SetCurrentSceneByIndex", "sceneIndex");
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.PREVIEW_SCENE_INDEX] = {
        type: "boolean",
        name: "Video Mixer: Preview Scene by index (active)",
        defaultStyle: {
            bgcolor: Color.GREEN,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                id: "scene-index",
                label: "Scene index",
                choices: getChoices("sceneIndex", "SetPreviewSceneByIndex", ssInstance.options),
                default: DEFAULT_CHOICE_ID,
            },
        ],
        callback: (feedback) => {
            return ssInstance.projectState.currentPreviewSceneIndex === feedback.options["scene-index"];
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_LATEST_PROJECT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "PreviewSceneChanged" });
            ssInstance.getOptions("SetPreviewSceneByIndex", "sceneIndex");
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.PROGRAM_SCENE_NAME] = {
        type: "boolean",
        name: "Video Mixer: Program Scene by name (active)",
        defaultStyle: {
            bgcolor: Color.RED,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                id: "scene-name",
                label: "Scene name",
                choices: getChoices("scene-name", "SetCurrentSceneByName", ssInstance.options),
                default: DEFAULT_CHOICE_ID,
            },
        ],
        callback: (feedback) => {
            return ssInstance.projectState.currentProgramSceneName === feedback.options["scene-name"];
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_LATEST_PROJECT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "ProgramSceneChanged" });
            ssInstance.getOptions("SetCurrentSceneByName", "scene-name");
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.PREVIEW_SCENE_NAME] = {
        type: "boolean",
        name: "Video Mixer: Preview Scene by name (active)",
        defaultStyle: {
            bgcolor: Color.GREEN,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                id: "scene-name",
                label: "Scene name",
                choices: getChoices("scene-name", "SetPreviewScene", ssInstance.options),
                default: DEFAULT_CHOICE_ID,
            },
        ],
        callback: (feedback) => {
            return ssInstance.projectState.currentPreviewSceneName === feedback.options["scene-name"];
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_LATEST_PROJECT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "PreviewSceneChanged" });
            ssInstance.getOptions("SetPreviewScene", "scene-name");
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.REPLAYS_PLAYBACK_SPEED_PREDEFINED] = {
        type: "boolean",
        name: "Replays: Playback speed (predefined, all slots)",
        defaultStyle: {
            bgcolor: Color.PURPLE,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                id: "speed",
                label: "Speed [%]",
                choices: [
                    {
                        id: 25,
                        label: "25%",
                    },
                    {
                        id: 33,
                        label: "33%",
                    },
                    {
                        id: 50,
                        label: "50%",
                    },
                    {
                        id: 75,
                        label: "75%",
                    },
                    {
                        id: 100,
                        label: "100%",
                    },
                ],
                default: 100,
            },
        ],
        callback: (feedback) => {
            return ssInstance.projectState.replaysPlaybackSpeed === feedback.options["speed"];
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_LATEST_PROJECT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "replays.slot.playback.speed" });
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.REPLAYS_PLAYBACK_SPEED] = {
        type: "boolean",
        name: "Replays: Playback speed (all slots)",
        defaultStyle: {
            bgcolor: Color.PURPLE,
            color: Color.BLACK,
        },
        options: [
            {
                type: "number",
                id: "speed",
                label: "Speed [%] (min 1, max 200)",
                default: 100,
                min: 1,
                max: 200,
            },
        ],
        callback: (feedback) => {
            return ssInstance.projectState.replaysPlaybackSpeed === feedback.options["speed"];
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_LATEST_PROJECT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "replays.slot.playback.speed" });
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.REPLAYS_SELECTED_SLOT] = {
        type: "boolean",
        name: "Replays: Selected slot",
        defaultStyle: {
            bgcolor: Color.PURPLE,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                id: "slot",
                label: "Slot index",
                choices: getChoices("slot", "replays.slot.select", ssInstance.options),
                default: DEFAULT_CHOICE_ID,
            },
        ],
        callback: (feedback) => {
            return ssInstance.projectState.replaysSelectedSlot === feedback.options["slot"];
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.GET_LATEST_PROJECT);
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "replays.slot.select" });
            ssInstance.getOptions("replays.slot.select", "slot");
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    feedbacks[Feedback.AUDIO_OUTPUT_MUTED] = {
        type: "boolean",
        name: "Audio Mixer Outputs: Output mute state",
        defaultStyle: {
            bgcolor: Color.RED,
            color: Color.BLACK,
        },
        options: [
            {
                type: "dropdown",
                id: "output",
                label: "Output",
                choices: getChoices("output", "audiomixer.output.muted", ssInstance.options),
                default: DEFAULT_CHOICE_ID,
            },
        ],
        callback: (feedback) => {
            const output = feedback.options["output"];
            const outputFromState = ssInstance.projectState.audioOutputs[output as string];
            if (typeof outputFromState === "undefined") return false;
            return outputFromState.muted;
        },
        subscribe: (feedback) => {
            ssInstance.addAwaitedRequest(RequestType.AUDIOMIXER_OUTPUT_MUTED, { output: feedback.options["output"] });
            ssInstance.addListenedUpdate({ feedbackId: feedback.id, updateType: "audiomixer.output.muted" });
            ssInstance.getOptions("audiomixer.output.muted", "output");
        },
        unsubscribe: (feedback) => {
            ssInstance.removeListenedUpdate(feedback.id);
        },
    };

    return feedbacks;
};

export default generateFeedbacks;
