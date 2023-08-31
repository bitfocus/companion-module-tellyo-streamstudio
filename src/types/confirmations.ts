import { InputValue } from "@companion-module/base";

export interface Confirmation {
    messageId: string;
    parametersConfirmations: ParameterConfirmation[];
}

export interface ParameterConfirmation {
    topic: string;
    newValue: InputValue;
}
