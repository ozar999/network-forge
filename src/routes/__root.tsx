import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Navbar } from "../components/Navbar";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NetSim — Network Simulation Platform" },
      { name: "description", content: "Master networking with interactive labs, simulations and courses" },
      { property: "og:title", content: "NetSim — Network Simulation Platform" },
      { property: "og:description", content: "Master networking with interactive labs, simulations and courses" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "NetSim — Network Simulation Platform" },
      { name: "twitter:description", content: "Master networking with interactive labs, simulations and courses" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7a1f7623-65d7-413c-b963-2fadd7e878dd" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7a1f7623-65d7-413c-b963-2fadd7e878dd" },
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
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-display text-terminal text-glow">404</h1>
        <p className="text-muted-foreground mt-4 text-sm">Route not found in network topology</p>
      </div>
    </div>
  ),
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
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}
