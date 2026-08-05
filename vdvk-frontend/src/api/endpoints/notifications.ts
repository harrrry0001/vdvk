import client from "../client";

export const notificationsApi = {
  list: (params?: Record<string, string>) => client.get("/notifications", { params }),
  getUnreadCount: () => client.get("/notifications/unread-count"),
  markRead: (id: string) => client.patch(`/notifications/${id}/read`),
  markAllRead: () => client.patch("/notifications/read-all"),
};
