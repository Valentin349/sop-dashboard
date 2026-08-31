import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dev only. Next 16's React debug channel decides "this document came from the browser
    // cache" by reading `performance.getEntriesByType("navigation")[0].transferSize === 0`,
    // and when it can't restore the matching sessionStorage entry it calls `location.reload()`
    // (client/dev/debug-channel.js). On this dashboard that read is 0 on every load, so the
    // reload re-enters the same check — a silent, endless full-page reload loop on `/`
    // (measured: ~1.6 loads a second, each a real `force-dynamic` server render).
    // Turning the channel off costs only React's extra debug info in dev.
    reactDebugChannel: process.env.NODE_ENV !== "development",
  },
};

export default nextConfig;
