/* This is copied from streamstudio-gateway\generators\json_definition_generator\types.ts for now */
export interface ApiDefinition {
    version: string;
    categories: ApiCategory[];
}

export interface ApiCategory {
    name: string;
    requestGroups: RequestGroup[];
}

export interface RequestGroup {
    name: string;
    requests: Request[];
}

export interface Request {
    type: string;
    requestParams: Parameter[];
    responseParams: Parameter[];
    method: RequestMethod;
    prettyName: string;
    description: string;
    group: string;
}

export interface Parameter {
    id: string;
    prettyName: string;
    property: ParameterProperty;
    type: ParameterType;
    range?: Range;
    defaultValue?: number | string | boolean;
    values?: string[];
}

export interface Range {
    min: number;
    max: number;
}

export enum ParameterProperty {
    ID = "id",
    OPTIONAL_ID = "optional_id",
    CONTROLLABLE = "controllable",
    REQUIRED = "required",
    OPTIONAL = "optional",
}

export enum ParameterType {
    CONST = "const",
    NUMBER = "number",
    BOOLEAN = "boolean",
    STRING = "string",
    SOURCE_NAME = "SourceName",
    SCENE_NAME = "SceneName",
    PLAYOUT_INDEX = "PlayoutIndex",
    PLAYOUT_NAME = "PlayoutName",
    PLAYLIST = "Playlist",
    SELECT = "select",
    REPLAYS_SLOT = "ReplaysSlot",
    TRANSITION_NAME = "TransitionName",
    SCENE_INDEX = "SceneIndex",
    LAYER_INDEX = "LayerIndex",
    SOURCE_INDEX = "SourceIndex",
    AUDIO_OUTPUT_NAME = "AudioOutputName",
}

export enum RequestMethod {
    GET = "get",
    SET = "set",
}

export interface ParameterOption {
    id: string | number | undefined;
    value: string;
}
