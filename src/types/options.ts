import { ParameterType } from "./apiDefinition";

export interface Option {
    id: string;
    value: string;
}

export interface Options {
    [id: string]: Option[];
}

export const COMMAND_PARMS_TYPES_WITHOUT_OPTIONS_TO_GET: ParameterType[] = ["boolean", "string", "number", "select"];
