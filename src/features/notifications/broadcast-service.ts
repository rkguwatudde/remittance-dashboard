import {
  adminBroadcast,
  type AdminBroadcastPayload,
  type AdminBroadcastResult,
  type AdminBroadcastTarget,
} from "@/lib/remittance-admin-api";

export type BroadcastComposerInput = {
  title: string;
  message: string;
  target: AdminBroadcastTarget;
  topic: string;
  userIdsRaw: string;
  actionUrl: string;
};

export type BroadcastPreview = {
  title: string;
  message: string;
  target: AdminBroadcastTarget;
  topic?: string;
  userIds: string[];
  data: Record<string, string>;
};

export type BroadcastActionLog = {
  id: string;
  adminEmail: string;
  createdAtIso: string;
  payload: BroadcastPreview;
  status: "sent" | "failed";
  detail: string;
};

export function prepareBroadcast(input: BroadcastComposerInput): {
  payload: AdminBroadcastPayload;
  preview: BroadcastPreview;
} {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    throw new Error("Title and message are required.");
  }

  const data: Record<string, string> = {};
  const actionUrl = input.actionUrl.trim();
  if (actionUrl) data.action_url = actionUrl;

  if (input.target === "topic") {
    const topic = input.topic.trim();
    if (!topic) throw new Error("Topic is required when target is topic.");
    return {
      payload: { title, message, target: "topic", topic, data },
      preview: { title, message, target: "topic", topic, userIds: [], data },
    };
  }

  if (input.target === "userIds") {
    const userIds = input.userIdsRaw
      .split(/[\n,]/g)
      .map((v) => v.trim())
      .filter(Boolean);
    if (!userIds.length) {
      throw new Error("Add at least one user ID when target is userIds.");
    }
    return {
      payload: { title, message, target: "userIds", userIds, data },
      preview: { title, message, target: "userIds", userIds, data },
    };
  }

  return {
    payload: { title, message, target: "all_users", data },
    preview: { title, message, target: "all_users", userIds: [], data },
  };
}

export async function sendBroadcastWithToken(
  withToken: <T>(fn: (token: string) => Promise<T>) => Promise<T>,
  payload: AdminBroadcastPayload,
): Promise<AdminBroadcastResult> {
  return withToken((token) => adminBroadcast(token, payload));
}
