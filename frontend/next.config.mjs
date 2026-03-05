/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Only compile the thirdweb exports actually imported — avoids compiling 141MB on startup
    optimizePackageImports: ["thirdweb"],
  },
};

export default nextConfig;
