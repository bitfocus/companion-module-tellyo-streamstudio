export interface Request {
    messageId: string;
    requestType: string;
}

export enum RequestType {
    GET_LATEST_PROJECT = "GetLatestProject",
    GET_DIRECT_EDIT = "GetDirectEdit",
    GET_AUDIO_MIXER_STATE = "GetAudioMixerState",
    AUDIOMIXER_OUTPUT_MUTED = "audiomixer.output.muted",
}

export type GenericObject = { [key: string]: any };
