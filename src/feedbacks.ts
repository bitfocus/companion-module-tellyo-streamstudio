import {
    CompanionFeedbackBooleanEvent,
    CompanionFeedbackDefinition,
    CompanionFeedbackDefinitions,
    CompanionFeedbackInfo,
    InputValue,
    SomeCompanionFeedbackInputField,
    combineRgb,
} from "@companion-module/base";
import StreamStudioInstance from "./index";
import { COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET } from "./types/options";
import { GROUPS_TO_SKIP, Request, RequestMethod } from "./types/apiDefinition";
import { getRequestMethod, transformDotCaseToTitleCase } from "./utils";
import { CompanionControlType } from "./types/stateStore";
import { getInput } from "./inputs";

const DEFAULT_CHOICE_ID = "default_option";
const REQUEST_TYPE_KEY = "request-type";

const isControllable = (prop?: string) =>
    prop === "controllable" || prop === "required";

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

const getCallback = (
    ssInstance: StreamStudioInstance,
    requestType: string,
    controlledParamId?: string
) => {
    return (feedback: CompanionFeedbackBooleanEvent) => {
        const state = ssInstance.feedbacksState[feedback.controlId];

        if (!state) {
            ssInstance.log(
                "warn",
                `Feedback state missing for controlId: ${feedback.controlId}`
            );
            return false;
        }

        const value = state.value;

        if (typeof value === "boolean") return value;
        if (value === DEFAULT_CHOICE_ID) return false;

        if (!controlledParamId) {
            ssInstance.log(
                "error",
                `Request ${requestType} - no value for controlled param.`
            );
            return false;
        }

        return value === feedback.options[controlledParamId];
    };
};

const generateFeedbacks = (
    ssInstance: StreamStudioInstance
): CompanionFeedbackDefinitions => {
    const feedbacks: CompanionFeedbackDefinitions = {};

    const { apiDefinition } = ssInstance;
    if (!apiDefinition) return feedbacks;

    const groups = Object.entries(apiDefinition).filter(
        ([key]) => !GROUPS_TO_SKIP.includes(key)
    );

    for (const [key, value] of groups) {
        const group = {
            name: transformDotCaseToTitleCase(key),
            id: key,
            requests: value,
        };

        group.requests.forEach((request) => {
            if (request.pretty_name === "") return;

            const {
                requestType,
                requestParams = [],
                responseParams = [],
                hidden,
                pretty_name,
                doc_request_description,
            } = request;

            if (hidden) return;

            const method = getRequestMethod(requestType);
            if (method !== RequestMethod.GET) return;

            let options: SomeCompanionFeedbackInputField[] = [];

            if (doc_request_description) {
                options.push({
                    id: "description",
                    type: "static-text",
                    label: "Description",
                    value: doc_request_description,
                });
            }

            requestParams.forEach((param) => {
                options = options.concat(
                    getInput(param, request, ssInstance, "feedback") as SomeCompanionFeedbackInputField[]
                );
            });

            let controlledParamId: string | undefined;

            responseParams.forEach((param) => {
                const { property, type, id } = param;

                if (isControllable(property)) {
                    if (type === "boolean") return;

                    options = options.concat(
                        getInput(param, request, ssInstance, "feedback") as SomeCompanionFeedbackInputField[]
                    );

                    controlledParamId = id;
                }
            });

            const setRequestType = `${requestType.substring(
                0,
                requestType.length - 3
            )}set`;

            const feedback: CompanionFeedbackDefinition = {
                name: `${group.name}: ${pretty_name}`,
                options,
                type: "boolean",

                defaultStyle: {
                    bgcolor: Color.RED,
                    color: Color.BLACK,
                },

                callback: getCallback(
                    ssInstance,
                    requestType,
                    controlledParamId
                ),

                subscribe: (feedback: CompanionFeedbackInfo) => {
                    responseParams.forEach((param) => {
                        if (isControllable(param.property)) {
                            ssInstance.feedbacksState[feedback.controlId] = {
                                requestType: setRequestType,
                                paramId: param.id,
                                value: DEFAULT_CHOICE_ID,
                                paramValues: feedback.options,
                                companionInstanceId: feedback.id,
                                requestParamsIds: requestParams.map(
                                    (p) => p.id
                                ),
                            };

                            const message: Partial<Request> = {
                                [REQUEST_TYPE_KEY]: request.requestType,
                            };

                            let areAllParametersSet = true;

                            requestParams.forEach((param) => {
                                const value =
                                    feedback.options[param.id] as InputValue;

                                if (value === DEFAULT_CHOICE_ID)
                                    areAllParametersSet = false;

                                message[param.id] = value;
                            });

                            if (areAllParametersSet) {
                                ssInstance.sendValueRequest(
                                    message as Request,
                                    feedback.controlId,
                                    param.id,
                                    CompanionControlType.FEEDBACK
                                );
                            }

                            ssInstance.addListenedUpdate(
                                setRequestType,
                                feedback.controlId
                            );

                            ssInstance.log(
                                "debug",
                                `Subscribed feedback ${requestType} (${feedback.controlId})`
                            );
                        }
                    });

                    requestParams.forEach((param) => {
                        if (
                            COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET.includes(
                                param.type
                            )
                        )
                            return;

                        ssInstance.getOptions(requestType, param.id);
                    });
                },

                unsubscribe: (feedback: CompanionFeedbackInfo) => {
                    ssInstance.removeListenedUpdate(feedback.controlId);
                    delete ssInstance.feedbacksState[feedback.controlId];

                    ssInstance.log(
                        "debug",
                        `Unsubscribed feedback (${feedback.controlId})`
                    );
                },
            };

            if (!feedbacks[request.requestType]) {
                feedbacks[request.requestType] = feedback;
            } else {
                ssInstance.log(
                    "warn",
                    `Duplicate feedback detected: ${request.requestType}`
                );
            }
        });
    }

    return feedbacks;
};

export default generateFeedbacks;
