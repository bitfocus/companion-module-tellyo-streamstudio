import { CompanionPresetDefinitions } from "@companion-module/base";
import { Color, Feedback } from "./feedbacks";

enum PresetsCategory {
    VIDEO_MIXER = "Video Mixer",
    REPLAYS = "Replays",
}

export const generatePresets = (): CompanionPresetDefinitions => {
    const presets: CompanionPresetDefinitions = {};

    // VIDEO MIXER

    Array.from(Array(8)).forEach((_value, index) => {
        const indexToDisplay = index + 1;
        presets[`preview-scene-${indexToDisplay}`] = {
            type: "button",
            category: PresetsCategory.VIDEO_MIXER,
            name: `Preview Scene ${indexToDisplay}`,
            style: {
                text: `PRV ${indexToDisplay}`,
                size: "auto",
                color: Color.WHITE,
                bgcolor: Color.BLACK,
            },
            steps: [
                {
                    down: [
                        {
                            actionId: "SetPreviewSceneByIndex",
                            options: {
                                sceneIndex: index,
                            },
                        },
                    ],
                    up: [],
                },
            ],
            feedbacks: [
                {
                    feedbackId: Feedback.PREVIEW_SCENE_INDEX,
                    options: {
                        "scene-index": index,
                    },
                    style: {
                        color: Color.BLACK,
                        bgcolor: Color.GREEN,
                    },
                },
            ],
        };
    });
    Array.from(Array(8)).forEach((_value, index) => {
        const indexForUser = index + 1;
        presets[`ProgramScene${indexForUser}`] = {
            type: "button",
            category: PresetsCategory.VIDEO_MIXER,
            name: `Program Scene ${indexForUser}`,
            style: {
                text: `PGM ${indexForUser}`,
                size: "auto",
                color: Color.WHITE,
                bgcolor: Color.BLACK,
            },
            steps: [
                {
                    down: [
                        {
                            actionId: "SetCurrentSceneByIndex",
                            options: {
                                sceneIndex: index,
                            },
                        },
                    ],
                    up: [],
                },
            ],
            feedbacks: [
                {
                    feedbackId: Feedback.PROGRAM_SCENE_INDEX,
                    options: {
                        "scene-index": index,
                    },
                    style: {
                        color: Color.BLACK,
                        bgcolor: Color.RED,
                    },
                },
            ],
        };
    });

    presets[`Cut`] = {
        type: "button",
        category: PresetsCategory.VIDEO_MIXER,
        name: `Cut`,
        style: {
            text: "Cut",
            size: "24",
            color: Color.WHITE,
            bgcolor: Color.BLACK,
        },
        steps: [
            {
                down: [
                    {
                        actionId: "Cut",
                        options: {},
                    },
                ],
                up: [],
            },
        ],
        feedbacks: [],
    };

    presets["Fade"] = {
        type: "button",
        category: PresetsCategory.VIDEO_MIXER,
        name: "Fade",
        style: {
            text: "Fade",
            size: "24",
            color: Color.WHITE,
            bgcolor: Color.BLACK,
        },
        steps: [
            {
                down: [
                    {
                        actionId: "TransitionToProgramCustom",
                        options: {
                            "with-transition.duration": 500,
                            "with-transition.name": "Fade",
                        },
                    },
                ],
                up: [],
            },
        ],
        feedbacks: [],
    };

    // REPLAYS

    Array.from(Array(4)).forEach((_value, index) => {
        const indexForUser = index + 1;
        presets[`SelectReplaysSlot${indexForUser}`] = {
            type: "button",
            category: PresetsCategory.REPLAYS,
            name: `Replays Slot ${indexForUser}`,
            style: {
                text: `REPLAY ${indexForUser}`,
                size: "auto",
                color: Color.WHITE,
                bgcolor: Color.BLACK,
            },
            steps: [
                {
                    down: [
                        {
                            actionId: "replays.slot.select",
                            options: {
                                slot: index,
                            },
                        },
                    ],
                    up: [],
                },
            ],
            feedbacks: [
                {
                    feedbackId: Feedback.REPLAYS_SELECTED_SLOT,
                    options: {
                        slot: index,
                    },
                    style: {
                        color: Color.BLACK,
                        bgcolor: Color.PURPLE,
                    },
                },
            ],
        };
    });

    [25, 33, 50, 75, 100].forEach((value) => {
        presets[`ReplaysPlaybackSpeed${value}`] = {
            type: "button",
            category: PresetsCategory.REPLAYS,
            name: `Replays Playback Speed ${value}%`,
            style: {
                text: `${value}%`,
                size: "auto",
                color: Color.WHITE,
                bgcolor: Color.BLACK,
            },
            steps: [
                {
                    down: [
                        {
                            actionId: "replays.slot.playback.speed",
                            options: {
                                speed_percent: value,
                                slot: "all",
                            },
                        },
                    ],
                    up: [],
                },
            ],
            feedbacks: [
                {
                    feedbackId: Feedback.REPLAYS_PLAYBACK_SPEED,
                    options: {
                        speed: value,
                        slot: "all",
                    },
                    style: {
                        color: Color.BLACK,
                        bgcolor: Color.PURPLE,
                    },
                },
            ],
        };
    });

    return presets;
};
