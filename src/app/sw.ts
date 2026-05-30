/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const pageCachePlugins = [
  new ExpirationPlugin({
    maxEntries: 64,
    maxAgeSeconds: 24 * 60 * 60,
  }),
];

/** Serve cached RSC/HTML immediately; revalidate in background (snappier PWA nav). */
const fastPageCache = [
  {
    matcher: ({
      request,
      url: { pathname },
      sameOrigin,
    }: {
      request: Request;
      url: URL;
      sameOrigin: boolean;
    }) =>
      request.headers.get("RSC") === "1" &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new StaleWhileRevalidate({
      cacheName: "mati-rsc",
      plugins: pageCachePlugins,
    }),
  },
  {
    matcher: ({
      request,
      url: { pathname },
      sameOrigin,
    }: {
      request: Request;
      url: URL;
      sameOrigin: boolean;
    }) =>
      request.headers.get("Content-Type")?.includes("text/html") &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new StaleWhileRevalidate({
      cacheName: "mati-html",
      plugins: pageCachePlugins,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...fastPageCache, ...defaultCache],
});

serwist.addEventListeners();

/** Web Push – show notifications from /api/push/send (web-push payload JSON). */
self.addEventListener("push", (event) => {
  const fallback = { title: "Mati", body: "", url: "/" };
  let payload = fallback;

  if (event.data) {
    try {
      payload = { ...fallback, ...event.data.json() };
    } catch {
      payload = { ...fallback, body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Mati", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients[0]) return clients[0].focus();
      return self.clients.openWindow(target);
    })
  );
});
