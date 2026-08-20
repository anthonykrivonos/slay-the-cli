import { serve } from "bun";
import index from "./index.html";

const server = serve({
  port: 3000,
  routes: {
    // Fully client-side game — the server only ships the bundle.
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🃏 Slay running at ${server.url}`);
