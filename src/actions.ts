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
import { DEFAULT_CHOICE_ID, getInput, useVariablesInputId } from "./inputs";

const getCallback = (request: RequestDefinition, ssInstance: StreamStudioInstance) => {
    return async (action: CompanionActionEvent, _context: CompanionCommonCallbackContext) => {
        const message: any = {
            "request-type": request.requestType,
        };

        let requiredParamNotSet = false;
        let variablesValueNotANumber = false;
        let failedToParseVariables = false;
        if (request.requestParams) {
            for (let param of request?.requestParams) {
                const { id, type, property, defaultValue } = param;
                if (type === "boolean" && id !== "controllerValue") continue;
                let value = action.options[id] as InputValue;
                if (typeof value === "undefined" || value === "undefined") {
                    // Handling required const parameters
                    if (property !== "required") continue;
                    if (defaultValue) value = defaultValue;
                }
                if (value === DEFAULT_CHOICE_ID) {
                    if (property === "required") {
                        requiredParamNotSet = true;
                    }
                    continue;
                }
                try {
                    if (
                        id === "controllerValue" &&
                        type === "number" &&
                        (action.options[useVariablesInputId] as boolean)
                    ) {
                        const parsed = await ssInstance.parseVariablesInString(action.options[`${id}-vars`] as string);
                        value = parseFloat(parsed);
                        if (isNaN(value)) variablesValueNotANumber = true;
                    }
                    if (id === "controllerValue" && type === "string") {
                        value = await ssInstance.parseVariablesInString(action.options[id] as string);
                    }
                } catch (e) {
                    failedToParseVariables = true;
                }
                message[id] = value;
            }
        }

        if (requiredParamNotSet) {
            ssInstance.log(
                "error",
                `Executing ${request.requestType}: command aborted because not all required parameters are set.`
            );
            return;
        }
        if (variablesValueNotANumber) {
            ssInstance.log(
                "error",
                `Executing ${request.requestType}: command aborted because expression with variables could not be converted to a number.`
            );
            return;
        }
        if (failedToParseVariables) {
            ssInstance.log(
                "error",
                `Executing ${request.requestType}: command aborted because expression with variables is invalid.`
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

            let options: SomeCompanionActionInputField[] = [];

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
                    param.options = param.options?.filter((option) => option.id !== undefined);
                }
                let isVisible = undefined;
                if (id === "controllerValue") {
                    if (hasControllableBooleanParam) {
                        isVisible = (options: CompanionOptionValues) => {
                            return options["controllerMode"] === "fixed";
                        };
                    }
                }

                options = options.concat(getInput(param, request, ssInstance, "action", isVisible));
            });

            const action: CompanionActionDefinition = {
                name: `${group.name}: ${
                    request.pretty_name ? request.pretty_name : transformDotCaseToTitleCase(request.requestType)
                }`,
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
