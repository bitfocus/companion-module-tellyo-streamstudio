import { EventEmitter } from "events";
import StreamStudioInstance from "./index";
import WebSocket, { MessageEvent } from "ws";
import { trimText } from "./utils";

export enum WebSocketStatus {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
    ERROR = 4,
}

export enum WebSocketEventType {
    MESSAGE = "MESSAGE",
    STATUS_CHANGED = "STATUS_CHANGED",
}

const LOG_PHRASES_BLACKLIST = ["audiomixer.vus", "MediaProgressNotify"];

class WebSocketInstance extends EventEmitter {
    private ws?: WebSocket;
    private wsUrl?: string;
    private ssInstance: StreamStudioInstance;
    private logMessages = false;

    constructor(ssInstance: StreamStudioInstance, logMessages = false) {
        super();
        this.ssInstance = ssInstance;
        this.logMessages = logMessages;
    }

    public connect = (host: string, port: number) => {
        if (this.ws) return;
        this.wsUrl = `ws://${host}:${port}`;
        this.ws = new WebSocket(this.wsUrl);
        this.updateStatus();

        this.ws.onopen = () => this.updateStatus();

        this.ws.onclose = () => {
            this.updateStatus();
            delete this.ws;
        };

        this.ws.onmessage = (event: MessageEvent) => {
            if (typeof event.data !== "string") return;
            const content = JSON.parse(event.data);
            this.logMessages && this.logMessage(event.data, this.ssInstance);
            this.emit(WebSocketEventType.MESSAGE, content);
        };

        this.ws.onerror = () => this.emit(WebSocketEventType.STATUS_CHANGED, WebSocketStatus.ERROR);
    };

    public send = (message: object) => {
        if (this.ws?.readyState !== 1) return;

        this.logMessages && this.ssInstance.log("debug", `Sending: ${JSON.stringify(message)}`);
        this.ws.send(JSON.stringify(message));
    };

    public disconnect = () => {
        if (this.ws?.readyState !== 1) return;

        this.ws.close();
        delete this.ws;
    };

    public getStatus = () => {
        const code = this.ws?.readyState === undefined ? WebSocketStatus.CLOSED : this.ws.readyState;
        return code as WebSocketStatus;
    };

    private updateStatus = () => {
        this.emit(WebSocketEventType.STATUS_CHANGED, this.getStatus());
    };

    private logMessage = (message: string, ssInstance: StreamStudioInstance) => {
        const containsPhraseFromBlackList = LOG_PHRASES_BLACKLIST.some((phrase) => message.includes(phrase));
        if (containsPhraseFromBlackList) return;
        ssInstance.log("debug", `Received: ${trimText(JSON.stringify(message), 150)}`);
    };
}

export default WebSocketInstance;
