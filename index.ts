// Entry point: serves the React UI via Bun's HTML import (bundles frontend.tsx
// and styles.css automatically). An /api/health route is included as a stub for
// any future server-side endpoints; all calculation currently runs client-side.
import index from "./src/ui/index.html";

const server = Bun.serve({
  port: Number(Bun.env.PORT ?? 3000),
  routes: {
    "/": index,
    "/api/health": {
      GET: () =>
        Response.json({ status: "ok", app: "pv-calculator", milestone: "M1" }),
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`P/V calculator running at ${server.url}`);
