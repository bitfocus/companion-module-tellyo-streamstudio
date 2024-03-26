import {
    CompanionOptionValues,
    InputValue,
    InstanceBase,
    InstanceStatus,
    SomeCompanionConfigField,
    runEntrypoint,
} from "@companion-module/base";
import { Config, getConfigFields } from "./config";
import { Option, Options } from "./types/options";
import generateActions, { getParameterTopic } from "./actions";
import generateFeedbacks from "./feedbacks";
import { ListenedUpdates } from "./types/updates";
import { ApiDefinition } from "./types/apiDefinition";
import { generatePresets } from "./presets";
import { CompanionControlType, State } from "./types/stateStore";
import { getAPIDefinition, NotificationTypes, Request, StreamStudioClient } from "studio-api-client";

const RECONNECT_INTERVAL_IN_MS = 2000;

class StreamStudioInstance extends InstanceBase<Config> {
    public options: Options = {};
    public apiDefinition: ApiDefinition | null = null;
    private activeRequests = 0;
    private listenedUpdates: ListenedUpdates = {};
    public config: Config = {
        ip: "",
        port: 0,
    };
    public client: StreamStudioClient;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    public actionsState: State = {};
    public feedbacksState: State = {};

    constructor(internal: unknown) {
        super(internal);
        this.client = new StreamStudioClient("companion-module");
    }

    // COMPANION METHODS
    public async init(config: Config): Promise<void> {
        this.config = config;

        this.client.on("gateway-connection" as NotificationTypes, this.onConnection);
        this.client.onws("closed", this.startReconnecting);
        this.client.onws("error", (e) => {
            this.log("error", JSON.stringify(e));
        });

        try {
            this.apiDefinition = getAPIDefinition();
        } catch (e) {
            this.updateStatus(InstanceStatus.ConnectionFailure);
            return;
        }

        try {
            await this.connectToWsServer();
        } catch (e) {
            this.updateStatus(InstanceStatus.ConnectionFailure);
        }
    }

    public async configUpdated(config: Config): Promise<void> {
        this.config = config;
        this.client.disconnect();
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
        this.log("debug", "Destroying...");
        this.stopReconnecting();
        this.removeAllUpdateListeners();
        this.client.disconnect();
        this.options = {};
        this.activeRequests = 0;
        this.actionsState = {};
        this.feedbacksState = {};
    }

    // ACTIONS / FEEDBACKS / PRESETS MANAGEMENT
    private onConnection = () => {
        this.log("debug", "Connected.");
        this.updateStatus(InstanceStatus.Ok);
        this.refreshAll();
        this.subscribeActions();
        this.subscribeFeedbacks();
    };

    private refreshAll = () => {
        this.updateActions();
        this.updateFeedbacks();
        this.checkFeedbacks();
        generatePresets();
    };

    // AUTO-RECONNECTING
    private connectToWsServer = async () => {
        this.updateStatus(InstanceStatus.Connecting);
        const { ip, port } = this.config;
        this.log("debug", `Connecting to ${ip} at port ${port}.`);
        return this.client.connect(`ws://${ip}:${port}`);
    };

    private startReconnecting = async () => {
        this.reconnectTimeout = setTimeout(async () => {
            this.log("debug", `Reconnecting...`);
            this.updateStatus(InstanceStatus.Disconnected, "Trying to reconnect");
            try {
                await this.connectToWsServer();
            } catch (e) {
                this.log("error", JSON.stringify(e));
                return;
            }
        }, RECONNECT_INTERVAL_IN_MS);
    };

    private stopReconnecting = () => {
        if (this.reconnectTimeout === null) return;
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    };

    // UPDATES
    private handleUpdate = (notification: any) => {
        const updateType = notification["update-type"];
        this.log("debug", "got update");
        this.log("debug", JSON.stringify(notification));
        this.log("debug", "feedbacks state");
        this.log("debug", JSON.stringify(this.feedbacksState));
        const feedbacksToUpdate: Set<string> = new Set();
        Object.values(this.actionsState).forEach((stateEntry) => {
            if (updateType !== stateEntry.requestType) return;
            const isEveryParamMatching = Object.entries(stateEntry.paramValues).every((entry) => {
                const [paramId, value] = entry;
                return notification[paramId] === value;
            });
            if (!isEveryParamMatching) return;

            stateEntry.value = notification[stateEntry.paramId];
        });
        Object.values(this.feedbacksState).forEach((stateEntry) => {
            if (updateType !== stateEntry.requestType) return;
            const isEveryParamMatching = Object.entries(stateEntry.paramValues).every((entry) => {
                const [paramId, value] = entry;
                return notification[paramId] === value;
            });

            if (!isEveryParamMatching) return;

            stateEntry.value = notification[stateEntry.paramId];

            feedbacksToUpdate.add(stateEntry.companionInstanceId);
        });
        this.log("debug", "feedbacks to ");
        this.log("debug", JSON.stringify(Array.from(feedbacksToUpdate)));

        this.checkFeedbacksById(...Array.from(feedbacksToUpdate));
    };

    public addListenedUpdate = (updateType: NotificationTypes, companionControlId: string) => {
        if (!Object.values(this.listenedUpdates).includes(updateType)) {
            this.log("debug", `Subscribing notification: ${updateType}`);
            this.client.on(updateType, this.handleUpdate);
        }
        this.listenedUpdates[companionControlId] = updateType;
    };

    public removeListenedUpdate = (companionControlId: string) => {
        const updateType = this.listenedUpdates[companionControlId];
        delete this.listenedUpdates[companionControlId];
        const isUpdateListened = Object.values(this.listenedUpdates).some((update) => update === updateType);
        if (!isUpdateListened) this.client.off(updateType, this.handleUpdate);
    };

    private removeAllUpdateListeners = () => {
        Object.keys(this.listenedUpdates).forEach(this.removeListenedUpdate);
    };

    // REQUESTS
    public sendValueRequest = (
        message: Request,
        companionControlId: string,
        companionId: string,
        paramId: string,
        paramValues: CompanionOptionValues,
        controlType: CompanionControlType
    ) => {
        this.activeRequests++;
        this.log("debug", "request");
        this.log("debug", JSON.stringify(message));
        this.client
            .send(message)
            .then((res) => {
                this.log("debug", "got value request response");
                this.log("debug", JSON.stringify(res));
                const value = (res as any)[paramId] as InputValue;
                if (controlType === CompanionControlType.ACTION) this.actionsState[companionControlId].value = value;
                if (controlType === CompanionControlType.FEEDBACK)
                    this.feedbacksState[companionControlId].value = value;
                this.log("debug", `settings state value: ${(res as any)[paramId]}`);
            })
            .catch((e) => {
                this.log("error", JSON.stringify(e));
            })
            .finally(() => {
                this.activeRequests--;
                if (this.activeRequests === 0) {
                    this.refreshAll();
                }
            });
    };

    public getOptions = (requestType: string, parameterName: string) => {
        this.log("debug", JSON.stringify({ requestType, parameterName }));
        this.activeRequests++;
        this.client
            .send({
                "request-type": "commands.parameter.options.get",
                requestType,
                parameterName,
            })
            .then((res) => {
                this.log("debug", JSON.stringify(res));
                const options = (res as any)["options"] as Option[];
                const topic = getParameterTopic(requestType, parameterName);
                this.options[topic] = options;
            })
            .catch((e) => {
                this.log("error", JSON.stringify(e));
            })
            .finally(() => {
                this.activeRequests--;
                if (this.activeRequests === 0) {
                    this.refreshAll();
                }
            });
    };

    public sendRequest = async (message: Request) => {
        this.log("debug", "sending message");
        this.log("debug", JSON.stringify(message));
        try {
            this.client.send(message);
        } catch (e) {
            this.log("error", JSON.stringify(e));
        }
    };

    // WEBSOCKET COMMUNICATION WRAPPERS
    private cancelUnnecessaryNotifications = () => {
        // can't cancel MediaProgressNotify, because it keeps the connection alive
        // can't cancel ProjectStateNotify, because respone to GetLatestProject has the same topic
        // const notificationsToCancel: string[] = [];
        // notificationsToCancel.forEach((notification) => {
        //     this.ws.send({
        //         "request-type": "TurnNotificationOff",
        //         "message-id": generateMessageId(),
        //         notyficationType: notification,
        //     });
        // }, this);
    };

    // COMPANION FUNCTION WRAPPERS

    private updateActions = () => {
        this.setActionDefinitions(generateActions(this));
    };

    private updateFeedbacks = () => {
        this.setFeedbackDefinitions(generateFeedbacks(this));
    };
}

export = StreamStudioInstance;

runEntrypoint(StreamStudioInstance, []);
