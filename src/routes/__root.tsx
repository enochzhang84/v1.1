import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { FloatingChat } from "@/components/FloatingChat";
import { I18nProvider } from "@/lib/i18n";
import { loadOfficialOrigin } from "@/lib/public-origin";

// Bump this string whenever you need to force every browser to drop its
// cached localStorage / sessionStorage state. Supabase auth keys (sb-*) are
// preserved so logged-in users don't get kicked out.
const APP_VERSION = "2026-05-26-1";

function useChromeCacheReset() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 1. Unregister any leftover service workers (kill-switch for old PWA SW).
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((rs) => rs.forEach((r) => r.unregister()))
          .catch(() => {});
      }
      if (typeof caches !== "undefined" && caches.keys) {
        caches.keys().then((names) => names.forEach((n) => caches.delete(n))).catch(() => {});
      }
    } catch {}
    // 2. Version-gate localStorage / sessionStorage to flush stale data.
    try {
      const stored = window.localStorage.getItem("__app_version");
      if (stored !== APP_VERSION) {
        const preserved: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("sb-") || k.startsWith("supabase.")) {
            const v = window.localStorage.getItem(k);
            if (v !== null) preserved[k] = v;
          }
        }
        window.localStorage.clear();
        for (const [k, v] of Object.entries(preserved)) {
          window.localStorage.setItem(k, v);
        }
        window.localStorage.setItem("__app_version", APP_VERSION);
        try { window.sessionStorage.clear(); } catch {}
      }
    } catch {}
  }, []);
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "教会新人登记系统" },
      { name: "description", content: "欢迎来到我们的教会 — 扫码登记,与您建立联系" },
      { property: "og:title", content: "教会新人登记系统" },
      { property: "og:description", content: "欢迎来到我们的教会 — 扫码登记,与您建立联系" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "教会新人登记系统" },
      { name: "twitter:description", content: "欢迎来到我们的教会 — 扫码登记,与您建立联系" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/30847a12-4ef6-4bd2-90a4-96a0143b7f6e/id-preview-b352fe13--03600c21-6ac2-4e92-8f55-87607a91ce41.lovable.app-1779417548772.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/30847a12-4ef6-4bd2-90a4-96a0143b7f6e/id-preview-b352fe13--03600c21-6ac2-4e92-8f55-87607a91ce41.lovable.app-1779417548772.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useChromeCacheReset();
  useEffect(() => { loadOfficialOrigin().catch(() => {}); }, []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideChat =
    pathname === "/" ||
    pathname === "/retreat" ||
    pathname === "/retreat-info" ||
    pathname === "/retreat-highlights" ||
    pathname.startsWith("/retreat-register") ||
    pathname.startsWith("/retreat-edit") ||
    pathname.startsWith("/display") ||
    pathname.startsWith("/signage") ||
    pathname.startsWith("/today-public") ||
    pathname === "/today-preview" ||
    pathname === "/chat";

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
        {!hideChat && <FloatingChat />}
      </I18nProvider>
    </QueryClientProvider>
  );
}
