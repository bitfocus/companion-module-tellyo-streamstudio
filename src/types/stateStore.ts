import { CompanionOptionValues, InputValue } from "@companion-module/base";

// key is Companion's action/feedback instance id
export type ActionsState = Record<string, ActionStateEntry>;
export type FeedbacksState = Record<string, FeedbackStateEntry>;

export enum CompanionControlType {
    ACTION = "ACTION",
    FEEDBACK = "FEEDBACK",
}

export interface ActionStateEntry {
    requestType: string;
    paramId: string;
    value: InputValue;
    paramValues: CompanionOptionValues;
}

export interface FeedbackStateEntry extends ActionStateEntry {
    companionInstanceId: string;
    /* Feedbacks have options for controllable value. It's important not to check them during
    update processing, because we have to update the state even if values from notification and
    state are different. That's why we keep request params ids, to check only params from request.*/
    requestParamsIds: string[];
}
