import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Staging is never indexed. The header covers every response, including files and API routes.
    if (process.env.SITE_ENV !== "staging") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
};

export default nextConfig;
