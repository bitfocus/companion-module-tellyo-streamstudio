import {
    CompanionFeedbackBooleanEvent,
    CompanionFeedbackDefinition,
    CompanionFeedbackDefinitions,
    CompanionFeedbackInfo,
    CompanionInputFieldCheckbox,
    CompanionInputFieldDropdown,
    CompanionInputFieldNumber,
    CompanionInputFieldTextInput,
    DropdownChoice,
    InputValue,
    SomeCompanionFeedbackInputField,
    combineRgb,
} from "@companion-module/base";
import StreamStudioInstance from "./index";
import { convertParamOptionsToChoices, getParameterTopic } from "./actions";
import { COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET, Options } from "./types/options";
import { GROUPS_TO_SKIP, RequestMethod } from "./types/apiDefinition";
import { commandParameterTypeToInputType, getRequestMethod, transformDotCaseToTitleCase } from "./utils";
import { NotificationTypes, Request, RequestDefinition, RequestParameter } from "studio-api-client";
import { CompanionControlType } from "./types/stateStore";

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

const getChoices = <T>(
    param: RequestParameter<T>,
    requestType: string,
    availableOptions: Options
): DropdownChoice[] => {
    if (param.type === "select" && param.values) return convertParamOptionsToChoices(param.values);
    const topic = getParameterTopic(requestType, param.id);
    if (typeof availableOptions[topic] !== "undefined") return convertParamOptionsToChoices(availableOptions[topic]);
    return [{ id: 0, label: "No options available." }];
};

const getInput = <T>(
    param: RequestParameter<T>,
    getRequest: RequestDefinition,
    ssInstance: StreamStudioInstance
): SomeCompanionFeedbackInputField => {
    const inputType = commandParameterTypeToInputType(param.type);
    switch (inputType) {
        case "number": {
            const label = param.range
                ? `${param.prettyName} (min ${param.range.min}, max ${param.range.max})`
                : param.prettyName;
            const input: CompanionInputFieldNumber = {
                type: "number",
                id: param.id,
                label,
                default: typeof param.defaultValue === "number" ? param.defaultValue : 0,
                min: (param.range?.min as number) || 0,
                max: (param.range?.max as number) || 0,
            };
            return input;
        }
        case "textinput": {
            const input: CompanionInputFieldTextInput = {
                type: "textinput",
                id: param.id,
                label: param.prettyName,
                default: typeof param.defaultValue === "string" ? param.defaultValue : undefined,
            };
            return input;
        }
        case "checkbox": {
            const input: CompanionInputFieldCheckbox = {
                type: "checkbox",
                id: param.id,
                label: param.prettyName,
                default: typeof param.defaultValue === "boolean" ? param.defaultValue : false,
            };
            return input;
        }
        case "dropdown": {
            const choices = getChoices(param, getRequest.requestType, ssInstance.options);
            const input: CompanionInputFieldDropdown = {
                type: "dropdown",
                id: param.id,
                label: `${param.prettyName}${param.property === "required" ? " (required)" : ""}`,
                choices,
                default: DEFAULT_CHOICE_ID,
            };
            return input;
        }
    }
};

const getCallback = (ssInstance: StreamStudioInstance) => {
    return (feedback: CompanionFeedbackBooleanEvent) => {
        const value = ssInstance.feedbacksState[feedback.controlId].value;
        ssInstance.log("debug", `feedback ${value}`);
        if (typeof value === "boolean") return value;
        return false;
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
            const { requestType, requestParams, hidden } = request;

            if (hidden) return;

            const method = getRequestMethod(requestType);

            if (method !== RequestMethod.SET) return;

            const options: SomeCompanionFeedbackInputField[] = [];
            let hasControllableBooleanParam = false;
            requestParams?.forEach((param) => {
                const { type, property } = param;
                if (["controllable", "required"].includes(property) && type === "boolean") {
                    hasControllableBooleanParam = true;
                    return;
                }
                options.push(getInput(param, request, ssInstance));
            });

            if (!hasControllableBooleanParam) return;

            const getRequestType = `${requestType.substring(0, requestType.length - 3)}get`;

            const getRequest = group.requests.find((request) => request.requestType === getRequestType);
            if (!getRequest) return;

            const feedback: CompanionFeedbackDefinition = {
                name: `${group.name}: ${getRequest.pretty_name}`,
                options,
                type: "boolean",
                defaultStyle: {
                    bgcolor: Color.RED,
                    color: Color.BLACK,
                },
                callback: getCallback(ssInstance),
                subscribe: (feedback: CompanionFeedbackInfo) => {
                    ssInstance.log("debug", JSON.stringify(getRequest));
                    request?.requestParams?.forEach((param) => {
                        ssInstance.log("debug", JSON.stringify(feedback.options));
                        if (param.type === "boolean" && ["controllable", "required"].includes(param.property)) {
                            ssInstance.log("debug", `adding state entry ${feedback.controlId}`);
                            ssInstance.log(
                                "debug",
                                JSON.stringify({
                                    requestType: request.requestType,
                                    paramId: param.id,
                                    value: DEFAULT_CHOICE_ID,
                                    paramValues: feedback.options,
                                    companionId: feedback.feedbackId,
                                    controlType: CompanionControlType.FEEDBACK,
                                })
                            );
                            // Add state entry
                            ssInstance.feedbacksState[feedback.controlId] = {
                                requestType: request.requestType,
                                paramId: param.id,
                                value: DEFAULT_CHOICE_ID,
                                paramValues: feedback.options,
                                companionInstanceId: feedback.id,
                            };

                            // Get initial value
                            const message: Record<string, InputValue> = {
                                "request-type": getRequest.requestType,
                            };
                            let areAllParametersSet = true;
                            request.requestParams?.forEach((param) => {
                                ssInstance.log("debug", `${param.id}: ${feedback.options[param.id]}`);

                                const value = feedback.options[param.id] as InputValue;
                                if (value === DEFAULT_CHOICE_ID) areAllParametersSet = false;
                                message[param.id] = value;
                            });

                            if (areAllParametersSet) {
                                ssInstance.sendValueRequest(
                                    message as Request,
                                    feedback.controlId,
                                    feedback.feedbackId,
                                    param.id,
                                    feedback.options,
                                    CompanionControlType.FEEDBACK
                                );
                            }

                            // Subscribe to notifications
                            ssInstance.addListenedUpdate(request.requestType as NotificationTypes, feedback.controlId);
                        }

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
