import { InstanceBase, InstanceStatus, SomeCompanionConfigField, runEntrypoint } from "@companion-module/base";
import { Config, getConfigFields } from "./config";
import WebSocketInstance, { WebSocketEventType, WebSocketStatus } from "./ws";
import {
    CommandsTemplatesWSMessage,
    GatewayConnectionWSMessage,
    ParameterOptionsWSMessage,
    UpdateWSMessage,
    WebSocketMessage,
    WebSocketMessageId,
    WebSocketUpdateTypes,
} from "./types/wsMessages";
import { Options } from "./types/options";
import { ComandTemplateGroup } from "./types/commandsTemplates";
import generateActions, { getParameterTopic } from "./actions";
import generateFeedbacks from "./feedbacks";
import { ProjectState } from "./types/projectState";
import { ListenedUpdate } from "./types/updates";
import { GenericObject, Request } from "./types/requests";
import { generateMessageId } from "./utils";
import { initProjectState } from "./projectState";
import { processRequest } from "./requests";
import { processUpdate } from "./updates";
import { generatePresets } from "./presets";

const RECONNECT_TIMEOUT_IN_MS = 1000;

class StreamStudioInstance extends InstanceBase<Config> {
    private ws = new WebSocketInstance(this, true);
    public options: Options = {};
    private commandsTemplates: ComandTemplateGroup[] = [];
    private activeOptionsCalls = 0;
    public projectState: ProjectState = initProjectState;
    private listenedUpdates: ListenedUpdate[] = [];
    private awaitedRequests: Request[] = [];
    public config: Config = {
        ip: "",
        port: 0,
    };

    constructor(internal: unknown) {
        super(internal);
    }

    // COMPANION METHODS
    public async init(config: Config): Promise<void> {
        this.config = config;

        this.ws.addListener(WebSocketEventType.STATUS_CHANGED, (status: WebSocketStatus) => {
            this.log("debug", `WebSocket status changed to ${status}`);
            switch (status) {
                case WebSocketStatus.OPEN:
                    this.updateStatus(InstanceStatus.Ok);
                    this.getCommandsTemplates();
                    break;
                case WebSocketStatus.CONNECTING:
                    this.updateStatus(InstanceStatus.Connecting);
                    break;
                case WebSocketStatus.CLOSED:
                    this.startReconnecting();
                    break;
                case WebSocketStatus.CLOSING:
                    this.updateStatus(InstanceStatus.Disconnected);
                    break;
                case WebSocketStatus.ERROR:
                    this.updateStatus(InstanceStatus.ConnectionFailure);
                    break;
            }
        });

        this.ws.addListener(WebSocketEventType.MESSAGE, (message: WebSocketMessage) => {
            const messageId = message["message-id"];
            switch (messageId) {
                case WebSocketMessageId.GET_COMMANDS_TEMPLATES_MSG_ID: {
                    const typedMessage = message as CommandsTemplatesWSMessage;
                    this.log("debug", `Got ${typedMessage.templatesGroups.length} command groups.`);
                    this.commandsTemplates = typedMessage.templatesGroups;
                    this.updateActions();
                    this.updateFeedbacks();
                    break;
                }
                case WebSocketMessageId.GET_PARAM_OPTIONS_MSG_ID: {
                    const typedMessage = message as ParameterOptionsWSMessage;
                    this.activeOptionsCalls--;
                    const topic = getParameterTopic(typedMessage.command, typedMessage.parameter);
                    this.options[topic] = typedMessage.options;
                    this.log("debug", `Got options for ${topic}`);
                    if (this.activeOptionsCalls === 0) {
                        this.log("debug", `All options calls finished, updating actions.`);
                        this.updateActions();
                        this.updateFeedbacks();
                    }
                    break;
                }
                case undefined: {
                    const typedMessage = message as UpdateWSMessage;
                    const updateType = typedMessage["update-type"];
                    if (typeof updateType === "undefined") return;
                    if (updateType === WebSocketUpdateTypes.GATEWAY_CONNECTION) {
                        const typedMessage = message as GatewayConnectionWSMessage;
                        if (typedMessage.connected) {
                            this.cancelUnnecessaryNotifications();
                            this.subscribeActions();
                            this.subscribeFeedbacks();
                            this.setPresetDefinitions(generatePresets());
                            return;
                        }
                        if (!typedMessage.connected) {
                            this.updateStatus(InstanceStatus.ConnectionFailure, "Connection to producer lost.");
                        }
                    }
                    const listenedUpdates = Array.from(
                        new Set(this.listenedUpdates.map((update) => update.updateType))
                    );
                    if (listenedUpdates.includes(updateType)) {
                        processUpdate(typedMessage, this);
                    }
                    break;
                }
                default: {
                    const messageId = message["message-id"];
                    const awaitedRequest = this.awaitedRequests.find((request) => request.messageId === messageId);
                    if (awaitedRequest) {
                        const typedMessage = message as UpdateWSMessage;
                        processRequest(typedMessage, awaitedRequest.requestType, this);
                        this.removeAwaitedRequest(messageId as string);
                    }
                }
            }
        });

        this.connectToWsServer();
    }

    public async configUpdated(config: Config): Promise<void> {
        this.config = config;
        this.ws.disconnect();
        this.stopReconnecting();

        if (!config.ip || !config.port) {
            this.updateStatus(InstanceStatus.BadConfig, "Missing Studio Controller IP and/or port.");
            return;
        }

        this.connectToWsServer();
    }

    public getConfigFields(): SomeCompanionConfigField[] {
        return getConfigFields();
    }

    public async destroy(): Promise<void> {
        this.stopReconnecting();
        this.ws.disconnect();
        this.commandsTemplates = [];
        this.options = {};
        this.activeOptionsCalls = 0;
        this.listenedUpdates = [];
        this.awaitedRequests = [];
    }

    // AUTO-RECONNECTING
    private reconnectTimer: NodeJS.Timer | null = null;

    private connectToWsServer = () => {
        const { ip, port } = this.config;
        this.log("debug", `Connecting to ${ip} at port ${port}.`);
        this.ws.connect(ip, port);
    };

    private startReconnecting = () => {
        this.updateStatus(InstanceStatus.Disconnected, "Trying to reconnect");
        this.reconnectTimer = setTimeout(() => {
            this.log("debug", `Reconnecting...`);
            this.connectToWsServer();
            this.reconnectTimer = null;
        }, RECONNECT_TIMEOUT_IN_MS);
    };

    private stopReconnecting = () => {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    };

    // UPDATES

    public addListenedUpdate = (newUpdate: ListenedUpdate) => {
        this.listenedUpdates.push(newUpdate);
    };

    public removeListenedUpdate = (feedbackId: string) => {
        this.listenedUpdates = this.listenedUpdates.filter((update) => update.feedbackId !== feedbackId);
    };

    // REQUESTS

    public addAwaitedRequest = (requestType: string, args?: GenericObject) => {
        const existingRequest = this.awaitedRequests.find((request) => request.requestType === requestType);
        if (existingRequest && typeof args === "undefined") return;
        const messageId = generateMessageId();
        this.awaitedRequests.push({ messageId, requestType });
        this.sendRequest(requestType, messageId, args);
    };

    public removeAwaitedRequest = (messageId: string) => {
        this.awaitedRequests = this.awaitedRequests.filter((confirmation) => confirmation.messageId !== messageId);
    };

    // SENDING REQUESTS

    private getCommandsTemplates = () => {
        this.ws.send({
            "request-type": "GetCommandsTemplates",
            "message-id": WebSocketMessageId.GET_COMMANDS_TEMPLATES_MSG_ID,
        });
    };

    public getOptions = (commandId: string, paramId: string) => {
        this.ws.send({
            "request-type": "GetOptions",
            "message-id": WebSocketMessageId.GET_PARAM_OPTIONS_MSG_ID,
            commandId,
            paramId,
        });
        this.activeOptionsCalls++;
    };

    // WEBSOCKET COMMUNICATION WRAPPERS

    public sendByWs = (message: any) => {
        this.ws.send(message);
    };

    public sendRequest = (type: string, messageId: string, args?: GenericObject) => {
        this.ws.send({ "request-type": type, "message-id": messageId, ...args });
    };

    private cancelUnnecessaryNotifications = () => {
        // can't cancel MediaProgressNotify, because it keeps the connection alive
        // can't cancel ProjectStateNotify, because respone to GetLatestProject has the same topic
        const notificationsToCancel: string[] = [];

        notificationsToCancel.forEach((notification) => {
            this.ws.send({
                "request-type": "TurnNotificationOff",
                "message-id": generateMessageId(),
                notyficationType: notification,
            });
        }, this);
    };

    // COMPANION FUNCTION WRAPPERS

    private updateActions = () => {
        this.setActionDefinitions(generateActions(this.commandsTemplates, this));
    };

    private updateFeedbacks = () => {
        this.setFeedbackDefinitions(generateFeedbacks(this));
    };
}

export = StreamStudioInstance;

runEntrypoint(StreamStudioInstance, []);
