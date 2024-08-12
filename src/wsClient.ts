import { EventEmitter } from "events";
import WebSocket, { MessageEvent } from "ws";

export type WsClientEvents = "connected" | "closed" | "warning" | "error" | "message";

export class WsClient {
    private ws?: WebSocket;
    private eventEmitter: EventEmitter;
    private wsUrl?: string;
    private connected = false;

    public idName = "message-id";

    constructor() {
        this.eventEmitter = new EventEmitter();
        this.eventEmitter.on("warning", (e) => this.emit("warning", e));
        this.eventEmitter.setMaxListeners(200);
    }

    connect(wsUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.wsUrl = wsUrl;
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                this.emit("connected", wsUrl);
                this.connected = true;
                resolve();
            };

            this.ws.onerror = (e: any) => {
                this.emit("error", e);
                reject(e);
            };

            this.ws.onclose = (e: any) => {
                this.emit("closed", e);
                this.connected = false;
            };

            this.ws.onmessage = (event: MessageEvent) => {
                const j = JSON.parse(event.data.toString());
                this.emit("message", j);
            };
        });
    }

    disconnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.ws) {
                return;
            }

            this.ws.onerror = (e: any) => {
                reject(e);
            };

            this.ws.onclose = (_e: any) => {
                resolve();
            };

            this.connected = false;
            this.ws.close();
            //this.ws.terminate();
        });
    }

    async send(msg: any) {
        return new Promise((resolve, reject) => {
            if (!this.ws) {
                reject(new Error("No ws client"));
            }

            if (msg[this.idName]) {
                const handler = (response: any) => {
                    if (response[this.idName] != msg[this.idName]) {
                        return;
                    }

                    this.off("message", handler);

                    if (response.status != "ok") {
                        reject(response);
                        return;
                    }

                    resolve(response);
                };
                this.on("message", handler);
            }

            this.ws!.send(JSON.stringify(msg));
            if (!msg[this.idName]) {
                resolve(msg);
            }
        });
    }

    public get url() {
        return this.wsUrl;
    }

    public get isConnected() {
        return this.connected;
    }

    private emit(event: WsClientEvents, data?: any) {
        this.eventEmitter.emit(event, data);
    }

    public on(event: WsClientEvents, f: (...args: any[]) => void) {
        this.eventEmitter.on(event, f);
    }

    public off(event: WsClientEvents, f: (...args: any[]) => void) {
        this.eventEmitter.off(event, f);
    }
}
