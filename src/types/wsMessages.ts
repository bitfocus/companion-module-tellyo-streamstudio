import { ComandTemplateGroup, CommandParameterOption } from "./commandsTemplates";

export enum WebSocketMessageId {
    GET_COMMANDS_TEMPLATES_MSG_ID = "commands_templates",
    GET_PARAM_OPTIONS_MSG_ID = "param_options",
}

export enum WebSocketUpdateTypes {
    GATEWAY_CONNECTION = "gateway-connection",
}

export interface WebSocketMessage {
    "message-id"?: WebSocketMessageId;
}

export interface CommandsTemplatesWSMessage extends WebSocketMessage {
    templatesGroups: ComandTemplateGroup[];
}

export interface ParameterOptionsWSMessage extends WebSocketMessage {
    command: string;
    parameter: string;
    options: CommandParameterOption[];
}

export interface UpdateWSMessage extends WebSocketMessage {
    "update-type": string;
    [key: string]: string | boolean | number | undefined | object;
}

export interface GatewayConnectionWSMessage extends UpdateWSMessage {
    connected: boolean;
}

export interface ConfirmationWSMessage extends WebSocketMessage {
    status: string;
}
