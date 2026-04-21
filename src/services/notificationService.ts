import { NOTIFICATION_DEFAULTS } from "../shared/constants.js";
import type { AppNotification, NotificationSettings } from "../shared/types.js";

type DesktopMode = "if-enabled" | "never" | "always";

type NotificationDispatch = {
  onInApp?: (notification: AppNotification) => void;
  onNative?: (notification: AppNotification) => void;
};

type NotificationInput = {
  type: AppNotification["type"];
  title: string;
  message: string;
  desktop?: DesktopMode;
};

function buildNotificationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

class NotificationService {
  private active = false;
  private settings: NotificationSettings = { ...NOTIFICATION_DEFAULTS };
  private dispatch: NotificationDispatch = {};

  setDispatch(dispatch: NotificationDispatch): void {
    this.dispatch = dispatch;
  }

  clearDispatch(): void {
    this.dispatch = {};
  }

  configure(settings?: Partial<NotificationSettings> | null): void {
    this.settings = { ...NOTIFICATION_DEFAULTS, ...(settings ?? {}) };
    this.active = true;
  }

  clearSettings(): void {
    this.settings = { ...NOTIFICATION_DEFAULTS };
    this.active = false;
  }

  notify(input: NotificationInput): AppNotification | null {
    if (!this.active || !this.settings.enabled || !this.settings[input.type]) {
      return null;
    }

    const notification: AppNotification = {
      id: buildNotificationId(),
      type: input.type,
      title: input.title,
      message: input.message,
      read: false,
      timestamp: new Date().toISOString(),
    };

    this.dispatch.onInApp?.(notification);

    const desktopMode = input.desktop ?? (input.type === "ai" ? "never" : "if-enabled");
    if (
      desktopMode === "always" ||
      (desktopMode === "if-enabled" && this.settings.desktopEnabled)
    ) {
      this.dispatch.onNative?.(notification);
    }

    return notification;
  }
}

export const notificationService = new NotificationService();
