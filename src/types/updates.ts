import { NotificationTypes } from "studio-api-client";

// Key is companion id (actionId/feedbackId)
export type ListenedUpdates = Record<string, NotificationTypes>;
