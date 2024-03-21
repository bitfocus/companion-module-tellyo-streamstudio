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
    InputValue,
    SomeCompanionActionInputField,
} from "@companion-module/base";
import { CompanionCommonCallbackContext } from "@companion-module/base/dist/module-api/common";
import {
    commandParameterTypeToInputType,
    generateMessageId,
    setValueAtPath,
    transformDotCaseToTitleCase,
} from "./utils";
import StreamStudioInstance from "./index";
import { Option, Options } from "./types/options";
import { Parameter, ParameterProperty, ParameterType, Request, RequestMethod } from "./types/apiDefinition";

const COMMANDS_CATEGORY_NAME = "commands";

const COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET = [
    ParameterType.BOOLEAN,
    ParameterType.STRING,
    ParameterType.CONST,
    ParameterType.NUMBER,
    ParameterType.SELECT,
];

export const getParameterTopic = (requestType: string, paramId: string) => {
    return `${requestType}/${paramId}`;
};

const DEFAULT_CHOICE_ID = "default_option";
const defaultChoice: DropdownChoice = {
    id: DEFAULT_CHOICE_ID,
    label: "Select an option...",
};

export const convertParamOptionsToChoices = (options: Option[] | string[]): DropdownChoice[] => {
    if (options.length === 0) return [defaultChoice];
    if (typeof options[0] === "string") {
        return [
            defaultChoice,
            ...options.map((option) => {
                const stringOption = option as string;
                return { id: stringOption, label: stringOption };
            }),
        ];
    }
    return [
        defaultChoice,
        ...options.map((option) => {
            const typedOption = option as Option;
            return {
                id: typeof typedOption.id === "undefined" ? "undefined" : typedOption.id,
                label: typedOption.value,
            };
        }),
    ];
};

const getChoices = (param: Parameter, requestType: string, availableOptions: Options): DropdownChoice[] => {
    if (param.type === ParameterType.SELECT && param.values) return convertParamOptionsToChoices(param.values);
    const topic = getParameterTopic(requestType, param.id);
    if (typeof availableOptions[topic] !== "undefined") return convertParamOptionsToChoices(availableOptions[topic]);
    return [{ id: 0, label: "No options available." }];
};

const getInput = (
    param: Parameter,
    setRequest: Request,
    ssInstance: StreamStudioInstance
): SomeCompanionActionInputField => {
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
                min: param.range?.min || 0,
                max: param.range?.max || 0,
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
            const choices = getChoices(param, setRequest.type, ssInstance.options);
            const input: CompanionInputFieldDropdown = {
                type: "dropdown",
                id: param.id,
                label: `${param.prettyName}${param.property === ParameterProperty.REQUIRED ? " (required)" : ""}`,
                choices,
                default: DEFAULT_CHOICE_ID,
            };
            return input;
        }
    }
};

const getCallback = (request: Request, ssInstance: StreamStudioInstance) => {
    return (action: CompanionActionEvent, _context: CompanionCommonCallbackContext) => {
        const messageId = generateMessageId();
        const message: any = {
            "request-type": request.type,
            "message-id": messageId,
        };

        let requiredParamNotSet = false;

        request.requestParams.forEach((param) => {
            if (param.type === ParameterType.BOOLEAN) {
                if (param.property !== ParameterProperty.CONTROLLABLE) {
                    return;
                }
                // const paremterTopic = getParameterTopic(request.type, param.id);
                // get stored value
                /* Logic for controllable boolean values goes here - we have to listen to notifications for them */
            }

            let value = action.options[param.id] as InputValue;
            if (typeof value === "undefined") {
                // Handling required const parameters
                if (param.type !== ParameterType.CONST || param.property !== ParameterProperty.REQUIRED) return;
                if (param.defaultValue) value = param.defaultValue;
            }
            if (value === DEFAULT_CHOICE_ID) {
                if (param.property === ParameterProperty.REQUIRED) {
                    requiredParamNotSet = true;
                }
                return;
            }

            setValueAtPath(message, value, param.id);
        });

        if (requiredParamNotSet) {
            ssInstance.log(
                "error",
                `Executing ${request.type}: command aborted because not all required parameters are set.`
            );
        }

        ssInstance.sendByWs(message);
    };
};

const generateActions = (ssInstance: StreamStudioInstance): CompanionActionDefinitions => {
    const actions: CompanionActionDefinitions = {};
    const { apiDefinition } = ssInstance;
    if (!apiDefinition) return actions;
    apiDefinition.categories.forEach((category) => {
        if (category.name === COMMANDS_CATEGORY_NAME) return;
        category.requestGroups.forEach((group) => {
            const groupName = transformDotCaseToTitleCase(group.name);

            const setRequest = group.requests.find((request) => request.method === RequestMethod.SET);
            if (!setRequest) return;
            const getRequest = group.requests.find((request) => request.method === RequestMethod.GET);
            let hasBooleanControllableParam = false;

            const options: SomeCompanionActionInputField[] = [];
            setRequest.requestParams.forEach((param) => {
                if (param.type === ParameterType.CONST) return;
                if (
                    [ParameterProperty.CONTROLLABLE, ParameterProperty.REQUIRED].includes(param.property) &&
                    param.type === ParameterType.BOOLEAN
                ) {
                    hasBooleanControllableParam = true;
                    return;
                }
                options.push(getInput(param, setRequest, ssInstance));
            });

            if (hasBooleanControllableParam && !getRequest) {
                return;
            }

            const action: CompanionActionDefinition = {
                name: `${groupName}: ${setRequest.prettyName}`,
                options: options,
                callback: getCallback(setRequest, ssInstance),
                subscribe: (action: CompanionActionInfo) => {
                    setRequest.requestParams.forEach((param) => {
                        if (
                            param.type === ParameterType.BOOLEAN &&
                            [ParameterProperty.CONTROLLABLE, ParameterProperty.REQUIRED].includes(param.property) &&
                            getRequest
                        ) {
                            ssInstance.addAwaitedRequest(getRequest.type, action.id, action.options);
                            // subskrybowanie notyfikacji
                        }

                        if (COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET.includes(param.type)) return;
                        ssInstance.getOptions(setRequest.type, param.id);
                    });
                },
                unsubscribe: () => {
                    // usuń awaited request w sumie też
                    // usuń zapis z state'u
                    //stop listening for notification jak jest boolean controllable
                },
            };

            actions[setRequest.type] = action;
        });
    });

    return actions;
};

export default generateActions;
