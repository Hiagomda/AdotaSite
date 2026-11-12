import type { NextConfig } from 'next';

const scriptSrc =
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

// Miniaturas dos posts vêm do imgproxy, em outro host. Lido no build; aceita vários endereços separados por espaço.
const mediaOrigin = process.env.ADMIN_MEDIA_ORIGIN ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${mediaOrigin}`,
              // Mapa da criação de evento: estilo e tiles do OpenFreeMap, busca de endereço no
              // Nominatim e os workers do MapLibre, que nascem de um blob.
              "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
