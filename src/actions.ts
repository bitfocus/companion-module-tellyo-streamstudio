import {
    CompanionActionDefinition,
    CompanionActionDefinitions,
    CompanionActionEvent,
    CompanionActionInfo,
    CompanionOptionValues,
    InputValue,
    SomeCompanionActionInputField,
} from "@companion-module/base";
import { getRequestMethod, transformDotCaseToTitleCase } from "./utils";
import StreamStudioInstance from "./index";
import { COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET } from "./types/options";
import { GROUPS_TO_SKIP, Request, RequestDefinition, RequestMethod } from "./types/apiDefinition";
import { CompanionCommonCallbackContext } from "@companion-module/base/dist/module-api/common";
import { CompanionControlType } from "./types/stateStore";
import { DEFAULT_CHOICE_ID, getInput } from "./inputs";

const getCallback = (request: RequestDefinition, ssInstance: StreamStudioInstance) => {
    return (action: CompanionActionEvent, _context: CompanionCommonCallbackContext) => {
        const message: any = {
            "request-type": request.requestType,
        };

        let requiredParamNotSet = false;

        request?.requestParams?.forEach((param) => {
            const { id, type, property, defaultValue } = param;
            if (type === "boolean" && id !== "controllerValue") {
                if (!["controllable", "required"].includes(property)) {
                    return;
                }
                const value = !ssInstance.actionsState[action.controlId].value;
                message[id] = value;
                return;
            }
            let value = action.options[id] as InputValue;
            if (typeof value === "undefined") {
                // Handling required const parameters
                if (property !== "required") return;
                if (defaultValue) value = defaultValue;
            }
            if (value === DEFAULT_CHOICE_ID) {
                if (property === "required") {
                    requiredParamNotSet = true;
                }
                return;
            }
            message[id] = value;
        });

        if (requiredParamNotSet) {
            ssInstance.log(
                "error",
                `Executing ${request.requestType}: command aborted because not all required parameters are set.`
            );
            return;
        }

        ssInstance.sendRequest(message);
    };
};

const generateActions = (ssInstance: StreamStudioInstance): CompanionActionDefinitions => {
    const actions: CompanionActionDefinitions = {};
    const { apiDefinition } = ssInstance;
    if (!apiDefinition) return actions;
    for (const [key, value] of Object.entries(apiDefinition)) {
        if (GROUPS_TO_SKIP.includes(key)) continue;
        const group = {
            name: transformDotCaseToTitleCase(key),
            id: key,
            requests: value,
        };

        group.requests.forEach((request) => {
            // To be removed when all requests gets a prettyName
            // if (request.pretty_name === "") return;
            const { requestType, requestParams, hidden } = request;

            if (hidden) return;

            const method = getRequestMethod(requestType);

            if (method === RequestMethod.GET) return;

            let hasControllableBooleanParam = false;
            let hasControllableNumberParam = false;
            const hasControllerModeParam = requestParams?.find((param) => param.id === "controllerMode");

            const options: SomeCompanionActionInputField[] = [];

            if (request.doc_request_description) {
                options.push({
                    id: "description",
                    type: "static-text",
                    label: "Description",
                    value: request.doc_request_description,
                });
            }

            requestParams?.forEach((param) => {
                const { type, property, id } = param;

                if (hasControllerModeParam && ["controllable", "required"].includes(property)) {
                    if (type === "number") {
                        hasControllableNumberParam = true;
                        return;
                    }
                    if (type === "boolean") {
                        hasControllableBooleanParam = true;
                        return;
                    }
                }
                if (param.property.includes("hidden") || param.property === "controllable") return;

                // Temporary solution
                if (id === "controllerMode") {
                    param.prettyName = "Mode";
                    if (hasControllableBooleanParam && param.values && typeof param.values[0] === "string") {
                        param.values = param.values
                            ?.filter((value) => value !== "relative")
                            .map((value) => ({
                                id: value,
                                value: value === "default" ? "toggle" : value,
                            }));
                    }
                    if (hasControllableNumberParam && param.values && typeof param.values[0] === "string") {
                        param.values = param.values?.filter((value) => value !== "default");
                    }
                }
                let isVisible = undefined;
                if (id === "controllerValue") {
                    param.prettyName = "Value";
                    if (hasControllableBooleanParam) {
                        isVisible = (options: CompanionOptionValues) => {
                            return options["controllerMode"] === "fixed";
                        };
                    }
                }

                options.push(getInput(param, request, ssInstance, isVisible));
            });

            const getRequestType = `${requestType.substring(0, requestType.length - 3)}get`;

            const getRequest = group.requests.find((request) => request.requestType === getRequestType);

            const action: CompanionActionDefinition = {
                name: `${group.name}: ${request.pretty_name ? request.pretty_name : request.requestType}`,
                options: options,
                callback: getCallback(request, ssInstance),
                subscribe: (action: CompanionActionInfo) => {
                    request?.requestParams?.forEach((param) => {
                        if (param.type === "boolean" && ["controllable", "required"].includes(param.property)) {
                            // Add state entry
                            ssInstance.actionsState[action.controlId] = {
                                requestType: request.requestType,
                                paramId: param.id,
                                value: DEFAULT_CHOICE_ID,
                                paramValues: action.options,
                            };

                            // Get initial value
                            const message: Record<string, InputValue> = {
                                "request-type": getRequest?.requestType || "",
                            };
                            let areAllParametersSet = true;
                            request.requestParams?.forEach((param) => {
                                const value = action.options[param.id] as InputValue;
                                if (value === DEFAULT_CHOICE_ID) areAllParametersSet = false;
                                message[param.id] = value;
                            });

                            if (areAllParametersSet) {
                                ssInstance.sendValueRequest(
                                    message as Request,
                                    action.controlId,
                                    param.id,
                                    CompanionControlType.ACTION
                                );
                            }

                            // Subscribe to notifications
                            ssInstance.addListenedUpdate(request.requestType, action.controlId);
                        }

                        if (COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET.includes(param.type)) return;
                        ssInstance.getOptions(requestType, param.id);
                    });
                },
                unsubscribe: (action: CompanionActionInfo) => {
                    ssInstance.removeListenedUpdate(action.controlId);
                    ssInstance.removeListenedUpdate(action.controlId);
                    delete ssInstance.actionsState[action.controlId];
                },
            };

            actions[request.requestType] = action;
        });
    }

    return actions;
};

export default generateActions;
