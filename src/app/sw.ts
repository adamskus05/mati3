/// <reference lib="webworker" />
import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Dynamic data and pages — always network (React Query + HydrationBoundary own caching). */
const networkOnlyRoutes = [
  {
    matcher: ({ url }: { url: URL }) => url.hostname.endsWith(".supabase.co"),
    handler: new NetworkOnly(),
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
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      request.headers.get("RSC") === "1",
    handler: new NetworkOnly(),
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
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      (request.mode === "navigate" ||
        request.headers.get("Accept")?.includes("text/html") === true),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({
      url: { pathname },
      sameOrigin,
    }: {
      url: URL;
      sameOrigin: boolean;
    }) => sameOrigin && pathname.startsWith("/h/"),
    handler: new NetworkOnly(),
  },
];

const skipPageCacheNames = new Set<string>([
  PAGES_CACHE_NAME.rscPrefetch,
  PAGES_CACHE_NAME.rsc,
  PAGES_CACHE_NAME.html,
  "others",
]);

const staticDefaultCache = defaultCache.filter((route) => {
  const cacheName = (route.handler as { cacheName?: string }).cacheName;
  return !cacheName || !skipPageCacheNames.has(cacheName);
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [...networkOnlyRoutes, ...staticDefaultCache],
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
