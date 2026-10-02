import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, devIndicators: false, turbopack: {root: process.cwd()}, serverExternalPackages:['pg'] };
export default config;
