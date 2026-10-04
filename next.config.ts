import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // The Russian and the English routes have their own root layouts (each sets its <html lang>),
  // so the page for a missing address is a document of its own: src/app/global-not-found.tsx.
  experimental: { globalNotFound: true },
};
export default config;
