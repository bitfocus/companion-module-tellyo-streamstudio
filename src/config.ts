import { Regex, SomeCompanionConfigField } from "@companion-module/base";

export interface Config {
    ip: string;
    port: number;
}

export const getConfigFields = (): SomeCompanionConfigField[] => {
    return [
        {
            type: "static-text",
            id: "info",
            width: 12,
            label: "Studio Controller",
            value: "This module connects to the Studio Controller app. Launch it and connect to the producer in order to control it using your Stream Deck.",
        },
        {
            type: "textinput",
            id: "ip",
            label: "Studio Controller IP address",
            width: 8,
            default: "127.0.0.1",
            regex: Regex.IP,
        },
        {
            type: "number",
            id: "port",
            label: "Studio Controller port",
            width: 4,
            default: 5656,
            min: 1,
            max: 65535,
            step: 1,
        },
    ];
};
