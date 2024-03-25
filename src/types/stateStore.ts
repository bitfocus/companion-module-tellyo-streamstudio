import { CompanionOptionValues, InputValue } from "@companion-module/base";

// key is Companion's action/feedback instance id
export type State = Record<string, StateEntry>;

export enum CompanionControlType {
    ACTION = "ACTION",
    FEEDBACK = "FEEDBACK",
}

export interface StateEntry {
    requestType: string;
    paramId: string;
    value: InputValue;
    paramValues: CompanionOptionValues;
    companionId: string;
    controlType: CompanionControlType;
}
