import {
    SomeCompanionFeedbackInputField,
    CompanionInputFieldNumber,
    CompanionInputFieldTextInput,
    CompanionInputFieldCheckbox,
    CompanionInputFieldDropdown,
    DropdownChoice,
    CompanionOptionValues,
} from "@companion-module/base";
import StreamStudioInstance from "./index";
import { RequestParameter, RequestDefinition, ParamOption } from "./types/apiDefinition";
import { commandParameterTypeToInputType } from "./utils";
import { Options } from "./types/options";

export const DEFAULT_CHOICE_ID = "default_option";
const defaultChoice: DropdownChoice = {
    id: DEFAULT_CHOICE_ID,
    label: "Select an option...",
};

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
    isVisible?: (options: CompanionOptionValues) => boolean
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
                min: (param.range?.min as number) || Number.MIN_SAFE_INTEGER,
                max: (param.range?.max as number) || Number.MAX_SAFE_INTEGER,
                isVisible,
            };
            return input;
        }
        case "textinput": {
            const input: CompanionInputFieldTextInput = {
                type: "textinput",
                id: param.id,
                label: param.prettyName,
                default: typeof param.defaultValue === "string" ? param.defaultValue : undefined,
                isVisible,
            };
            return input;
        }
        case "checkbox": {
            const input: CompanionInputFieldCheckbox = {
                type: "checkbox",
                id: param.id,
                label: param.prettyName,
                default: typeof param.defaultValue === "boolean" ? param.defaultValue : false,
                isVisible,
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
                isVisible,
            };
            return input;
        }
    }
};
