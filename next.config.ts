import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The attendance form used to live at `/attendance` and is now the homepage.
   * Links already handed out in Discord cannot be recalled, so the old path
   * keeps resolving — 308 rather than 307 so clients cache it and the request
   * method survives, and query strings are forwarded automatically.
   */
  async redirects() {
    return [{ source: "/attendance", destination: "/", permanent: true }];
  },
};

export default nextConfig;
