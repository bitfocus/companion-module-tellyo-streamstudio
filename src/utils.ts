import { ParameterType } from "studio-api-client";
import { v4 as uuidv4 } from "uuid";

export const transformDotCaseToTitleCase = (text: string) => {
    return text
        .split(".")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export const commandParameterTypeToInputType = (type: ParameterType) => {
    switch (type) {
        case "number":
            return "number";
        case "boolean":
            return "checkbox";
        case "string":
            return "textinput";
        default:
            return "dropdown";
    }
};

export const generateMessageId = () => `COMPANION_MODULE_TELLYO_STREAMSTUDIO_${uuidv4()}`;

export const trimText = (text: string, _length: number) => {
    return text;
    // return `${text.substring(0, length)}${text.length > length ? "..." : ""}`;
};

export const setValueAtPath = (obj: any, value: any, path: string) => {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length; ++i) {
        const key = parts[i];
        if (i === parts.length - 1) {
            current[key] = value;
            return;
        }

        if (!current[key]) {
            current[key] = {};
        }

        current = current[key];
    }
};

export const getValueAtPath = (obj: any, path: string) => {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length; ++i) {
        const key = parts[i];
        if (i === parts.length - 1) {
            return current[key];
        }

        if (!current[key]) {
            return;
        }

        current = current[key];
    }
    return;
};

export const getRequestMethod = (requestType: string) => {
    const parts = requestType.split(".");
    return parts[parts.length - 1];
};
