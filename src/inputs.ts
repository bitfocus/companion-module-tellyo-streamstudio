import {
    CompanionInputFieldNumber,
    CompanionInputFieldTextInput,
    CompanionInputFieldCheckbox,
    CompanionInputFieldDropdown,
    DropdownChoice,
    CompanionOptionValues,
    SomeCompanionActionInputField,
    SomeCompanionFeedbackInputField,
} from "@companion-module/base";
import StreamStudioInstance from "./index";
import { RequestParameter, RequestDefinition, ParamOption } from "./types/apiDefinition";
import { commandParameterTypeToInputType, transformCamelCaseToNormalCase } from "./utils";
import { Options } from "./types/options";

export const DEFAULT_CHOICE_ID = "default_option";
const defaultChoice: DropdownChoice = {
    id: DEFAULT_CHOICE_ID,
    label: "Select an option...",
};
export const useVariablesInputId = "useVariables";

export const getParameterTopic = (requestType: string, paramId: string) => {
    return `${requestType}/${paramId}`;
};

const convertParamOptionsToChoices = <T>(options: ParamOption[]): DropdownChoice[] => {
    if (options.length === 0) return [defaultChoice];
    return [
        defaultChoice,
        ...options.map((option) => {
            const typedOption = option;
            return {
                id: typedOption.id || "undefined",
                label: typedOption.label,
            };
        }),
    ];
};

const getChoices = <T>(
    param: RequestParameter<T>,
    requestType: string,
    availableOptions: Options
): DropdownChoice[] => {
    if (param.type === "select" && param.options) return convertParamOptionsToChoices(param.options);
    const topic = getParameterTopic(requestType, param.id);
    if (typeof availableOptions[topic] !== "undefined") return convertParamOptionsToChoices(availableOptions[topic]);
    return [{ id: 0, label: "No options available." }];
};

export const getInput = <T>(
    param: RequestParameter<T>,
    getRequest: RequestDefinition,
    ssInstance: StreamStudioInstance,
    actionOrFeedback: "action" | "feedback",
    isVisible?: (options: CompanionOptionValues) => boolean
): SomeCompanionActionInputField[] | SomeCompanionFeedbackInputField[] => {
    const inputType = commandParameterTypeToInputType(param.type);
    const name = param.prettyName ? param.prettyName : transformCamelCaseToNormalCase(param.id);
    switch (inputType) {
        case "number": {
            const inputs: SomeCompanionActionInputField[] = [];
            const label = param.range ? `${name} (min ${param.range.min}, max ${param.range.max})` : name;

            if (param.id === "controllerValue" && actionOrFeedback === "action") {
                const useVariablesCheckbox: CompanionInputFieldCheckbox = {
                    type: "checkbox",
                    id: useVariablesInputId,
                    label: "Use variables",
                    default: false,
                };
                const variablesInput: CompanionInputFieldTextInput = {
                    type: "textinput",
                    id: `${param.id}-vars`,
                    label: name,
                    default: typeof param.defaultValue === "number" ? param.defaultValue.toString() : "0",
                    isVisible: (options) => options.useVariables === true,
                    useVariables: { local: true },
                };
                inputs.push(useVariablesCheckbox, variablesInput);
            }
            const input: CompanionInputFieldNumber = {
                type: "number",
                id: param.id,
                label,
                default: typeof param.defaultValue === "number" ? param.defaultValue : 0,
                min: (param.range?.min as number) || Number.MIN_SAFE_INTEGER,
                max: (param.range?.max as number) || Number.MAX_SAFE_INTEGER,
                isVisible:
                    param.id === "controllerValue" && actionOrFeedback === "action"
                        ? (options) => options.useVariables === false
                        : isVisible,
            };
            inputs.push(input);
            return inputs;
        }
        case "textinput": {
            const input: CompanionInputFieldTextInput = {
                type: "textinput",
                id: param.id,
                label: name,
                default: typeof param.defaultValue === "string" ? param.defaultValue : undefined,
                isVisible,
                useVariables:
                    param.id === "controllerValue" && actionOrFeedback === "action" ? { local: true } : undefined,
            };
            return [input];
        }
        case "checkbox": {
            const input: CompanionInputFieldCheckbox = {
                type: "checkbox",
                id: param.id,
                label: name,
                default: typeof param.defaultValue === "boolean" ? param.defaultValue : false,
                isVisible,
            };
            return [input];
        }
        case "dropdown": {
            const choices = getChoices(param, getRequest.requestType, ssInstance.options);
            const input: CompanionInputFieldDropdown = {
                type: "dropdown",
                id: param.id,
                label: `${name}${param.property === "required" ? " (required)" : ""}`,
                choices,
                default: DEFAULT_CHOICE_ID,
                isVisible,
            };
            return [input];
        }
    }
};
