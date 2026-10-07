import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a phone or another computer on the home network open `npm run dev` (hot reload is blocked otherwise).
  allowedDevOrigins: ["192.168.1.205"],
  async headers() {
    // Staging is never indexed. The header covers every response, including files and API routes.
    if (process.env.SITE_ENV !== "staging") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
};

export default nextConfig;
