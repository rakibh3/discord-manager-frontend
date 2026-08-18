import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The attendance form moved from `/attendance` to the homepage; links already
  // in Discord keep resolving. 308 so clients cache it and the method survives.
  async redirects() {
    return [{ source: "/attendance", destination: "/", permanent: true }];
  },
};

export default nextConfig;
