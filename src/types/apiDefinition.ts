import { RequestDefinition } from "studio-api-client";

export type ApiDefinition = { [key: string]: RequestDefinition[] };

export const GROUPS_TO_SKIP = ["frontend"];

export enum RequestMethod {
    GET = "get",
    SET = "set",
}
