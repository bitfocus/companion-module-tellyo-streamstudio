import { RequestDefinition } from "studio-api-client";

export type ApiDefinition = { [key: string]: RequestDefinition[] };

export interface Range {
    min: number;
    max: number;
}

export enum RequestMethod {
    GET = "get",
    SET = "set",
}

export interface ParameterOption {
    id: string | number | undefined;
    value: string;
}
