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

const getCallback = (ssInstance: StreamStudioInstance, requestType: string, controlledParamId?: string) => {
    return (feedback: CompanionFeedbackBooleanEvent) => {
        const value = ssInstance.feedbacksState[feedback.controlId].value;
        if (typeof value === "boolean") return value;
        if (value === DEFAULT_CHOICE_ID) return false;
        if (!controlledParamId) {
            ssInstance.log("error", `Request ${requestType} - no value for controlled param.`);
            return false;
        }
        return value === feedback.options[controlledParamId];
    };
};

const generateFeedbacks = (ssInstance: StreamStudioInstance): CompanionFeedbackDefinitions => {
    const feedbacks: CompanionFeedbackDefinitions = {};

    const { apiDefinition } = ssInstance;
    if (!apiDefinition) return feedbacks;
    for (const [key, value] of Object.entries(apiDefinition)) {
        if (GROUPS_TO_SKIP.includes(key)) continue;
        const group = {
            name: transformDotCaseToTitleCase(key),
            id: key,
            requests: value,
        };
        group.requests.forEach((request) => {
            // To be removed when all requests gets a prettyName
            if (request.pretty_name === "") return;
            const { requestType, requestParams, hidden, responseParams } = request;

            if (hidden) return;

            const method = getRequestMethod(requestType);

            if (method !== RequestMethod.GET) return;

            const options: SomeCompanionFeedbackInputField[] = [];

            if (request.doc_request_description) {
                options.push({
                    id: "description",
                    type: "static-text",
                    label: "Description",
                    value: request.doc_request_description,
                });
            }

            requestParams?.forEach((param) => {
                options.push(getInput(param, request, ssInstance));
            });
            let controlledParamId;
            responseParams?.forEach((param) => {
                const { property, type, id } = param;
                if (["controllable", "required"].includes(property)) {
                    if (type === "boolean") return;
                    options.push(getInput(param, request, ssInstance));
                    controlledParamId = id;
                }
            });

            const setRequestType = `${requestType.substring(0, requestType.length - 3)}set`;

            const feedback: CompanionFeedbackDefinition = {
                name: `${group.name}: ${request.pretty_name}`,
                options,
                type: "boolean",
                defaultStyle: {
                    bgcolor: Color.RED,
                    color: Color.BLACK,
                },
                callback: getCallback(ssInstance, requestType, controlledParamId),
                subscribe: (feedback: CompanionFeedbackInfo) => {
                    request?.responseParams?.forEach((param) => {
                        if (["controllable", "required"].includes(param.property)) {
                            // Add state entry
                            ssInstance.feedbacksState[feedback.controlId] = {
                                requestType: setRequestType,
                                paramId: param.id,
                                value: DEFAULT_CHOICE_ID,
                                paramValues: feedback.options,
                                companionInstanceId: feedback.id,
                                requestParamsIds: requestParams ? requestParams?.map((param) => param.id) : [],
                            };

                            // Get initial value
                            const message: Record<string, InputValue> = {
                                "request-type": request.requestType,
                            };
                            let areAllParametersSet = true;
                            request.requestParams?.forEach((param) => {
                                const value = feedback.options[param.id] as InputValue;
                                if (value === DEFAULT_CHOICE_ID) areAllParametersSet = false;
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

                            // Subscribe to notifications
                            ssInstance.addListenedUpdate(setRequestType, feedback.controlId);
                        }
                    });

                    requestParams?.forEach((param) => {
                        if (COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET.includes(param.type)) return;
                        ssInstance.getOptions(requestType, param.id);
                    });
                },
                unsubscribe: (feedback: CompanionFeedbackInfo) => {
                    ssInstance.removeListenedUpdate(feedback.controlId);
                    ssInstance.removeListenedUpdate(feedback.controlId);
                    delete ssInstance.feedbacksState[feedback.controlId];
                },
            };

            feedbacks[request.requestType] = feedback;
        });
    }

    return feedbacks;
};

export default generateFeedbacks;
