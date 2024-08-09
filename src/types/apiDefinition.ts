export type ParameterType =
    | "hidden"
    | "number"
    | "boolean"
    | "string"
    | "select"
    | "array"
    | "array of strings"
    | "object"
    | "SceneType"
    | "SourceType"
    | "SourceName"
    | "LayerName"
    | "SceneName"
    | "PlayoutIndex"
    | "PlayoutName"
    | "PlaylistName"
    | "PlaylistSource"
    | "ReplaysSlot"
    | "TransitionName"
    | "SceneIndex"
    | "LayerIndex"
    | "SourceIndex"
    | "AudioOutputName"
    | "PluginName"
    | "ParameterName"
    | "AudioSubgroupName"
    | "ParameterType"
    | "ExistingChannelIdParameter"
    | "ConferenceNameParameter"
    | "PlayoutSourceName";

export type ParameterProperty = "controllable" | "required" | "optional" | "optional hidden";

export interface Range<ValueType> {
    min: ValueType;
    max: ValueType;
}

export interface RequestParameter<ValueType> {
    type: ParameterType;
    property: ParameterProperty;
    id: string;
    prettyName: string;
    description?: string;
    values?: Array<ValueType>;
    defaultValue?: ValueType;
    range?: Range<ValueType>;
}

export interface RequestDefinition {
    hidden?: boolean;

    pretty_name: string;

    doc_request_description: string;
    doc_request_example?: string;

    doc_response_description: string;
    doc_response_example?: string;

    requestType: string;
    requestParams?: Array<RequestParameter<any>>;

    responseParams?: Array<RequestParameter<any>>;
}

export type Notification = any;
export type Request = any;
export type SuccessResponse = any;

export type ApiDefinition = { [key: string]: RequestDefinition[] };

export const GROUPS_TO_SKIP = ["frontend"];

export enum RequestMethod {
    GET = "get",
    SET = "set",
}
