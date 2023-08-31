// prepared based on implementation in lactaoc

export type CommandId = string;
export type CommandType = string;
export type CommandParameterValueType = string | number | boolean | undefined;
export interface Range {
    min: number;
    max: number;
}

export enum CommandParameterProperty {
    ID = "id",
    OPTIONAL_ID = "optional_id",
    CONTROLLABLE = "controllable",
    REQUIRED = "required",
    OPTIONAL = "optional",
    READ_ONLY_CONTROLLABLE = "read_only_controllable",
}

export enum CommandParameterType {
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

export interface CommandParameterOption {
    id: string | number | undefined;
    value: string;
}

export interface CommandParameter {
    id: string;
    description: string;
    property: CommandParameterProperty;
    type: CommandParameterType;
    options?: CommandParameterOption[] | string[];
    range?: Range;
    value?: CommandParameterValueType;
}

export interface CommandTemplate {
    id: CommandId;
    type?: CommandType;
    description: string;
    parameters: CommandParameter[];
}

export interface ComandTemplateGroup {
    name: string;
    templates: CommandTemplate[];
}
