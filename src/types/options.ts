import { ParameterType, ParamOption } from "./apiDefinition";

export interface Options {
    [id: string]: ParamOption[];
}

export const COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET: ParameterType[] = ["boolean", "string", "number", "select"];
