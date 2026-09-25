import type { NextConfig } from "next";

// —— 安全响应头配置
const isDev = process.env.NODE_ENV === "development";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  connect-src 'self';
`.replace(/\s{2,}/g, " ").trim();

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: cspHeader,
  },
];

const corsAllowOrigin = isDev ? "*" : process.env.CORS_ALLOWED_ORIGINS;

const corsHeaders = [
  ...(corsAllowOrigin ? [{ key: "Access-Control-Allow-Origin", value: corsAllowOrigin }] : []),
  {
    key: "Access-Control-Allow-Methods",
    value: "GET, POST, PUT, DELETE, OPTIONS",
  },
  {
    key: "Access-Control-Allow-Headers",
    value: "Content-Type, Authorization",
  },
  {
    key: "Access-Control-Max-Age",
    value: "86400",
  },
];

// —— 允许的 dev server 来源（用于 HMR/WebSocket 校验）
// 从 NEXT_ALLOWED_DEV_ORIGINS 环境变量读（多值用逗号分隔），如：
//   NEXT_ALLOWED_DEV_ORIGINS=192.168.64.231,my-lan.local
// —— 当 NEXT_ALLOWED_DEV_ORIGINS=* 时自动加入 localhost/10.x/192.168.x/127.0.0.1 等常见局域网 host
// —— 注意：Next.js 16 只接受纯 host（不加协议、不加端口）
function resolveAllowedDevOrigins(): string[] {
  const raw = process.env.NEXT_ALLOWED_DEV_ORIGINS;
  if (!raw) return [];
  if (raw.trim() === "*") {
    // 宽松模式：加入常见的局域网/本地 host
    return [
      "localhost",
      "127.0.0.1",
      "10.82.23.73",
    ];
  }
  return raw
    .split(",")
    .map((s) => {
      // 去掉 http:// / https:// / 端口，确保是纯 host
      let h = s.trim();
      h = h.replace(/^https?:\/\//, "");
      h = h.replace(/:\d+$/, "");
      return h;
    })
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  // 生产构建时输出 standalone 模式，减小 Docker 镜像体积
  // 设置 NEXT_STANDALONE=1 环境变量启用，或 NODE_ENV=production 时自动启用
  // 参考：https://nextjs.org/docs/app/api-reference/next-config-js/output
  output:
    process.env.NEXT_STANDALONE === "1" || process.env.NODE_ENV === "production"
      ? "standalone"
      : undefined,

  allowedDevOrigins: resolveAllowedDevOrigins(),
  // turbopack 在本机会 panic，注释掉以使用默认的 webpack
  // turbopack: {
  //   root: __dirname,
  // },
  async rewrites() {
    return [
      {
        source: "/@vite/client",
        destination: "/_noop.js",
      },
      {
        source: "/@vite/:path*",
        destination: "/_noop.js",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: corsHeaders,
      },
    ];
  },
};

export default nextConfig;
