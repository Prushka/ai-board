declare module 'next-pwa' {
  import { NextConfig } from 'next';
  export default function withPWA(config: {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    // ... add other options as needed
  }): (nextConfig: NextConfig) => NextConfig;
}
