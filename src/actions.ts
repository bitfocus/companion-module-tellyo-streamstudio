import {
    CompanionActionDefinition,
    CompanionActionDefinitions,
    CompanionActionEvent,
    CompanionActionInfo,
    CompanionInputFieldCheckbox,
    CompanionInputFieldDropdown,
    CompanionInputFieldNumber,
    CompanionInputFieldTextInput,
    DropdownChoice,
    SomeCompanionActionInputField,
} from "@companion-module/base";
import {
    ComandTemplateGroup,
    CommandParameter,
    CommandParameterOption,
    CommandParameterProperty,
    CommandParameterType,
    CommandTemplate,
} from "./types/commandsTemplates";
import { CompanionCommonCallbackContext } from "@companion-module/base/dist/module-api/common";
import { commandParameterTypeToInputType, generateMessageId, setValueAtPath, transformToTitleCase } from "./utils";
import StreamStudioInstance from "./index";
import { Options } from "./types/options";
import { getBooleanState } from "./projectState";
import { Confirmation } from "./types/confirmations";
import { RequestType } from "./types/requests";

const COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET = [
    CommandParameterType.BOOLEAN,
    CommandParameterType.STRING,
    CommandParameterType.CONST,
    CommandParameterType.NUMBER,
    CommandParameterType.SELECT,
];

// Only when value is stored in module's projectState then it can be used as toggle
const BOOLEAN_CONTROLLABLE_TOPICS_WITH_STORED_VALUES = [
    "SetDirectEditScene/active",
    "SetDirectEditLayer/active",
    "SetProgramMuted/muted",
    "audiomixer.output.muted/muted",
];

export const getParameterTopic = (commandId: string, paramId: string) => {
    return `${commandId}/${paramId}`;
};

const DEFAULT_CHOICE_ID = "default_option";
const defaultChoice: DropdownChoice = {
    id: DEFAULT_CHOICE_ID,
    label: "Select an option...",
};

export const convertParamOptionsToChoices = (options: CommandParameterOption[] | string[]): DropdownChoice[] => {
    if (options.length === 0) return [defaultChoice];
    if (typeof options[0] === "string") {
        return [
            defaultChoice,
            ...options.map((option) => {
                const stringOption = option as string;
                return { id: stringOption, label: transformToTitleCase(stringOption) };
            }),
        ];
    }
    return [
        defaultChoice,
        ...options.map((option) => {
            const typedOption = option as CommandParameterOption;
            return {
                id: typeof typedOption.id === "undefined" ? "undefined" : typedOption.id,
                label: typedOption.value,
            };
        }),
    ];
};

const getChoices = (param: CommandParameter, commandId: string, availableOptions: Options): DropdownChoice[] => {
    if (param.type === CommandParameterType.SELECT && param.options) return convertParamOptionsToChoices(param.options);
    const topic = getParameterTopic(commandId, param.id);
    if (typeof availableOptions[topic] !== "undefined") return convertParamOptionsToChoices(availableOptions[topic]);
    return [{ id: 0, label: "No options available." }];
};

const getInput = (
    param: CommandParameter,
    template: CommandTemplate,
    ssInstance: StreamStudioInstance
): SomeCompanionActionInputField => {
    const inputType = commandParameterTypeToInputType(param.type);
    switch (inputType) {
        case "number": {
            const label = param.range
                ? `${param.description} (min ${param.range.min}, max ${param.range.max})`
                : param.description;
            const input: CompanionInputFieldNumber = {
                type: "number",
                id: param.id,
                label,
                default: typeof param.value === "number" ? param.value : 0,
                min: param.range?.min || 0,
                max: param.range?.max || 0,
            };
            return input;
        }
        case "textinput": {
            const input: CompanionInputFieldTextInput = {
                type: "textinput",
                id: param.id,
                label: param.description,
                default: typeof param.value === "string" ? param.value : undefined,
            };
            return input;
        }
        case "checkbox": {
            const input: CompanionInputFieldCheckbox = {
                type: "checkbox",
                id: param.id,
                label: param.description,
                default: typeof param.value === "boolean" ? param.value : false,
            };
            return input;
        }
        case "dropdown": {
            const choices = getChoices(param, template.id, ssInstance.options);
            const input: CompanionInputFieldDropdown = {
                type: "dropdown",
                id: param.id,
                label: `${param.description}${
                    param.property === CommandParameterProperty.REQUIRED ? " (required)" : ""
                }`,
                choices,
                default: DEFAULT_CHOICE_ID,
            };
            return input;
        }
    }
};

const getCallback = (template: CommandTemplate, ssInstance: StreamStudioInstance) => {
    return (action: CompanionActionEvent, _context: CompanionCommonCallbackContext) => {
        const messageId = generateMessageId();
        const message: any = {
            "request-type": template.type,
            "message-id": messageId,
        };
        const confirmation: Confirmation = {
            messageId,
            parametersConfirmations: [],
        };

        let requiredParamNotSet = false;

        template.parameters.forEach((param) => {
            if (param.type === CommandParameterType.BOOLEAN) {
                if (param.property !== CommandParameterProperty.CONTROLLABLE) {
                    return;
                }
                const paremterTopic = getParameterTopic(template.id, param.id);
                if (BOOLEAN_CONTROLLABLE_TOPICS_WITH_STORED_VALUES.includes(paremterTopic)) {
                    const value = !getBooleanState(paremterTopic, action.options, ssInstance.projectState);
                    message[param.id] = value;
                    confirmation.parametersConfirmations.push({
                        topic: paremterTopic,
                        newValue: value,
                    });
                    return;
                }
            }

            const value = action.options[param.id];
            if (typeof value === "undefined") return;
            if (value === DEFAULT_CHOICE_ID) {
                if (param.property === CommandParameterProperty.REQUIRED) {
                    requiredParamNotSet = true;
                }
                return;
            }

            setValueAtPath(message, value, param.id);
            confirmation.parametersConfirmations.push({
                topic: getParameterTopic(template.id, param.id),
                newValue: value,
            });
        });

        if (requiredParamNotSet) {
            ssInstance.log(
                "error",
                `Executing ${template.id} ${template.description} command aborted because not all required parameters are set.`
            );
        }

        ssInstance.sendByWs(message);
        ssInstance.addAwaitedConfirmation(confirmation);
    };
};

const generateActions = (
    commandGroups: ComandTemplateGroup[],
    ssInstance: StreamStudioInstance
): CompanionActionDefinitions => {
    const actions: CompanionActionDefinitions = {};
    commandGroups.forEach((group) => {
        group.templates.forEach((template) => {
            const groupName = transformToTitleCase(group.name);

            const options: SomeCompanionActionInputField[] = [];
            template.parameters.forEach((param) => {
                if (param.type === CommandParameterType.CONST) return;
                if (
                    param.property === CommandParameterProperty.CONTROLLABLE &&
                    param.type === CommandParameterType.BOOLEAN &&
                    BOOLEAN_CONTROLLABLE_TOPICS_WITH_STORED_VALUES.includes(getParameterTopic(template.id, param.id))
                )
                    return;
                options.push(getInput(param, template, ssInstance));
            });

            const action: CompanionActionDefinition = {
                name: `${groupName}: ${template.description}`,
                options: options,
                callback: getCallback(template, ssInstance),
                subscribe: (action: CompanionActionInfo) => {
                    template.parameters.forEach((param) => {
                        if (COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET.includes(param.type)) return;
                        ssInstance.getOptions(template.id, param.id);

                        switch (template.id) {
                            case "SetProgramMuted": {
                                ssInstance.addAwaitedRequest(RequestType.AUDIOMIXER_OUTPUT_MUTED, {
                                    output: "Master",
                                });
                                break;
                            }
                            case "audiomixer.output.muted": {
                                ssInstance.addAwaitedRequest(RequestType.AUDIOMIXER_OUTPUT_MUTED, {
                                    output: action.options["output"],
                                });
                                break;
                            }
                            case "SetDirectEditScene":
                            case "SetDirectEditLayer": {
                                ssInstance.addAwaitedRequest(RequestType.GET_DIRECT_EDIT);
                                break;
                            }
                        }
                    });
                },
            };

            actions[template.id] = action;
        });
    });

    return actions;
};

export default generateActions;
