import {
    InputValue,
    InstanceBase,
    InstanceStatus,
    SomeCompanionConfigField,
    runEntrypoint,
} from "@companion-module/base";
import { Config, getConfigFields } from "./config";
import { Options } from "./types/options";
import generateActions from "./actions";
import generateFeedbacks from "./feedbacks";
import { ListenedUpdates } from "./types/updates";
import { ApiDefinition, ParamOption, Request } from "./types/apiDefinition";
import { generatePresets } from "./presets";
import { CompanionControlType, ActionsState, FeedbacksState } from "./types/stateStore";
import { StreamStudioClient } from "./studioApiClient";
import { getParameterTopic } from "./inputs";
import { generateMessageId } from "./utils";
import { v4 as uuidv4 } from "uuid";
import https from "https";

const API_DEFINITION_URL = "https://app-dev.tellyo.com/studio/api/";
//const API_DEFINITION_URL = "https://app-qa.tellyo.com/studio/api/";
//const API_DEFINITION_URL = "https://app.tellyo.com/studio/api/";

const RECONNECT_INTERVAL_IN_MS = 2000;
const PING_INTERVAL_IN_MS = 5000;
export const APPLICATION_NAME = "COMPANION_MODULE_TELLYO_STREAMSTUDIO";

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
    public actionsState: ActionsState = {};
    public feedbacksState: FeedbacksState = {};
    private sessionId = "";
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(internal: unknown) {
        super(internal);
        this.client = new StreamStudioClient("companion-module");
    }

    // COMPANION METHODS
    public async init(config: Config): Promise<void> {
        this.config = config;

        this.client.on("gateway-connection", this.onConnection);
        this.client.onws("closed", this.startReconnecting);
        this.client.onws("error", (e: any) => {
            this.log("error", JSON.stringify(e));
        });

        try {
            this.apiDefinition = await this.getApiDefinition();
        } catch (e) {
            this.log("error", (e as Error).message);
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
        this.sessionId = uuidv4();
        this.log("debug", "Connected.");
        this.sendHello();
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
        this.createVariables();
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
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
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
        this.log("debug", `Got update: ${JSON.stringify(notification)}`);
        const feedbacksToUpdate: Set<string> = new Set();
        Object.values(this.actionsState).forEach((stateEntry) => {
            if (updateType !== stateEntry.requestType) return;
            const isEveryParamMatching = Object.entries(stateEntry.paramValues).every((entry) => {
                const [paramId, value] = entry;
                if (["controllerValue", "controllerMode"].includes(paramId)) return true;
                return notification[paramId] === value;
            });
            if (!isEveryParamMatching) return;

            stateEntry.value = notification[stateEntry.paramId];
        });
        Object.values(this.feedbacksState).forEach((stateEntry) => {
            const setRequestType = `${stateEntry.requestType.substring(0, stateEntry.requestType.length - 3)}set`;
            if (updateType !== setRequestType) return;
            const isEveryParamMatching = stateEntry.requestParamsIds.every((paramId) => {
                return notification[paramId] === stateEntry.paramValues[paramId];
            });

            if (!isEveryParamMatching) return;

            stateEntry.value = notification[stateEntry.paramId];

            feedbacksToUpdate.add(stateEntry.companionInstanceId);
        });
        this.log("debug", `Updating feedbacks: ${JSON.stringify(Array.from(feedbacksToUpdate))}`);

        this.checkFeedbacksById(...Array.from(feedbacksToUpdate));
    };

    public addListenedUpdate = (updateType: string, companionControlId: string) => {
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
        paramId: string,
        controlType: CompanionControlType
    ) => {
        this.activeRequests++;
        this.log("debug", `Sending value request: ${JSON.stringify(message)}`);
        this.client
            .send(message)
            .then((res) => {
                this.log("debug", `Got value request response: ${JSON.stringify(res)}`);
                const value = (res as any)[paramId] as InputValue;
                if (controlType === CompanionControlType.ACTION) this.actionsState[companionControlId].value = value;
                if (controlType === CompanionControlType.FEEDBACK)
                    this.feedbacksState[companionControlId].value = value;
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
        const request: Request = {
            "request-type": "commands.parameter.options.get",
            requestType,
            parameterName,
        };
        this.log("debug", `Sending options request: ${JSON.stringify(request)}`);
        this.activeRequests++;
        this.client
            .send(request)
            .then((res) => {
                this.log("debug", `Options response: ${JSON.stringify(res)}`);
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
        this.log("debug", `Sending request: ${JSON.stringify(message)}`);
        try {
            await this.client.send(message);
        } catch (e) {
            this.log("error", JSON.stringify(e));
        }
    };

    private sendHello = () => {
        const message = {
            "request-type": "session.hello.set",
            "message-id": generateMessageId(),
            applicationId: this.sessionId,
            applicationName: APPLICATION_NAME,
        };
        this.client
            .send(message)
            .then((res) => {
                this.log("debug", `Got hello request response: ${JSON.stringify(res)}`);
            })
            .catch((e) => {
                this.log("error", JSON.stringify(e));
            });
        this.pingInterval = setInterval(() => {
            const startTimestamp = Date.now();
            this.client
                .send({
                    "request-type": "session.ping",
                    "message-id": generateMessageId(),
                    clientTs: Date.now(),
                })
                .then((res) => {
                    this.log("debug", `Got ping request response: ${JSON.stringify(res)}`);
                    this.setVariableValues({ latency: Date.now() - startTimestamp });
                })
                .catch((e) => {
                    this.log("error", JSON.stringify(e));
                });
        }, PING_INTERVAL_IN_MS);
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

    private createVariables = () => {
        this.setVariableDefinitions([{ variableId: "latency", name: "Latency to Stream Studio producer" }]);
    };

    // GETTING JSON API DEFINITION
    private getApiDefinition = (): Promise<ApiDefinition> => {
        this.log("debug", `Fetching JSON API definition from ${API_DEFINITION_URL}`);
        return new Promise((resolve, reject) => {
            https
                .get(API_DEFINITION_URL, (res) => {
                    let data = "";

                    res.on("data", (chunk) => {
                        data += chunk;
                    });

                    res.on("end", () => {
                        try {
                            const jsonData = JSON.parse(data);
                            resolve(jsonData);
                        } catch (error) {
                            reject(new Error("Error parsing JSON: " + (error as Error).message));
                        }
                    });
                })
                .on("error", (err) => {
                    reject(new Error("Error fetching data: " + err.message));
                });
        });
    };
}

export default StreamStudioInstance;

runEntrypoint(StreamStudioInstance, []);
