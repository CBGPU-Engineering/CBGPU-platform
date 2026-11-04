import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { proxyClientMaxBodySize: '24mb' },
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // @sparticuz/chromium ships a large native binary that Next.js's bundler
  // shouldn't try to trace/inline — it needs to stay a plain node_modules require.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.namu.wiki' },
      { protocol: 'https', hostname: 'fclbzjlcepoaifvcoxdw.supabase.co' },
      { protocol: 'https', hostname: 'cbgpu.com', pathname: '/backend/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'i.scdn.co' },
    ],
  },
  async rewrites() {
    // Only public Supabase APIs are routed; Studio and Postgres stay private.
    return [{source:'/api/files/:path*',destination:'http://127.0.0.1:8421/:path*'}, { source: '/backend/functions/v1/contact', destination: '/api/contact' }, ...['auth', 'rest', 'storage', 'realtime', 'functions'].map(service => ({
      source: `/backend/${service}/v1/:path*`,
      destination: `http://127.0.0.1:54321/${service}/v1/:path*`,
    }))];
  },
  async redirects() {
    return ['www.cbgpu.com', 'cbgpu.airhood.dev'].map(host => ({
      source: '/:path*', has: [{ type: 'host' as const, value: host }],
      destination: 'https://cbgpu.com/:path*', permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // The Flutter app calls these same /api/* routes directly (see
        // cbgpu_app's lib/core/api_config.dart) instead of duplicating their
        // server-side logic — Flutter Web enforces CORS the same way any
        // browser does, so without this every one of those calls gets
        // silently blocked client-side despite the server responding fine
        // (confirmed: curl succeeds, but no Access-Control-Allow-Origin
        // header was ever set). Native builds (Android/iOS/desktop) aren't
        // subject to CORS at all, only the web target needs this. Every
        // route here already does its own auth checks internally (bearer
        // tokens, admin checks) — CORS only controls which origins' JS can
        // read the response, not authorization, so opening it doesn't
        // weaken anything those routes already enforce.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-cbgpu-auth, x-cbgpu-device, x-jwt' },
        ],
      },
    ];
  },
};

export default nextConfig;
