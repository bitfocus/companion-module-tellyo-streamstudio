import EventEmitter from "events";
import { WsClient, WsClientEvents } from "./wsClient";
import { Notification, Request, SuccessResponse } from "./types/apiDefinition";

function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
}

function generateId(prefix: string) {
    return `${prefix}_${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export class StreamStudioClient {
    private events = new EventEmitter();
    private wsClient = new WsClient();

    constructor(private clientName: string) {
        this.wsClient.on("message", (msg) => {
            const updateType = msg["update-type"];
            if (updateType) {
                this.events.emit(updateType, msg);
            }
        });
    }

    public connect = (url: string): Promise<any> => {
        return this.wsClient.connect(url);
    };

    public disconnect = (): Promise<any> => {
        return this.wsClient.disconnect();
    };

    public onws = (event: WsClientEvents, f: (...args: any[]) => void) => this.wsClient.on(event, f);
    public offws = (event: WsClientEvents, f: (...args: any[]) => void) => this.wsClient.off(event, f);

    public get isConnected() {
        return this.wsClient.isConnected;
    }

    public get url() {
        return this.wsClient.url;
    }

    public on = (notificationType: string, listener: (notification: Notification) => void) => {
        this.events.on(notificationType, listener);
    };

    public once = (notificationType: string, listener: (notification: Notification) => void) => {
        this.events.once(notificationType, listener);
    };

    public off = (notificationType: string, listener: (notification: Notification) => void) => {
        this.events.on(notificationType, listener);
    };

    public send = async (request: Request): Promise<SuccessResponse> => {
        return this.wsClient.send({
            ...request,
            "message-id": generateId(this.clientName),
        }) as Promise<SuccessResponse>;
    };
}
