import {
    CompanionActionDefinition,
    CompanionActionDefinitions,
    CompanionActionEvent,
    CompanionOptionValues,
    InputValue,
    SomeCompanionActionInputField,
} from "@companion-module/base";
import { getRequestMethod, transformDotCaseToTitleCase } from "./utils";
import StreamStudioInstance from "./index";
import { COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET } from "./types/options";
import { GROUPS_TO_SKIP, RequestDefinition, RequestMethod } from "./types/apiDefinition";
import { CompanionCommonCallbackContext } from "@companion-module/base/dist/module-api/common";
import { DEFAULT_CHOICE_ID, getInput } from "./inputs";

const getCallback = (request: RequestDefinition, ssInstance: StreamStudioInstance) => {
    return (action: CompanionActionEvent, _context: CompanionCommonCallbackContext) => {
        const message: any = {
            "request-type": request.requestType,
        };

        let requiredParamNotSet = false;

        request?.requestParams?.forEach((param) => {
            const { id, type, property, defaultValue } = param;
            if (type === "boolean" && id !== "controllerValue") return;
            let value = action.options[id] as InputValue;
            if (typeof value === "undefined" || value === "undefined") {
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

                if (id === "controllerMode") {
                    param.prettyName = "Mode";
                    param.options = param.options?.filter((option) => option.id !== undefined);
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

            const action: CompanionActionDefinition = {
                name: `${group.name}: ${request.pretty_name ? request.pretty_name : request.requestType}`,
                options: options,
                callback: getCallback(request, ssInstance),
                subscribe: () => {
                    request?.requestParams?.forEach((param) => {
                        if (COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET.includes(param.type)) return;
                        ssInstance.getOptions(requestType, param.id);
                    });
                },
            };

            actions[request.requestType] = action;
        });
    }

    return actions;
};

export default generateActions;
