import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, devIndicators: false, turbopack: {root: process.cwd()}, serverExternalPackages:['pg'], images:{remotePatterns:[{protocol:'http',hostname:'localhost',port:'59020'},{protocol:'http',hostname:'127.0.0.1',port:'59020'}]} };
export default config;
