import { listsApi } from "@/lib/api";

/** Convert a base64url VAPID key to the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Request notification permission, subscribe to Web Push using the server's
 * VAPID key, and register the subscription with the API. Returns the endpoint.
 */
export async function enablePush(): Promise<string> {
  if (!pushSupported()) throw new Error("Push notifications are not supported here.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied.");

  const { publicKey } = await listsApi.pushKey();
  const registration = await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = subscription.toJSON();
  await listsApi.pushSubscribe({
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
  });
  return subscription.endpoint;
}
