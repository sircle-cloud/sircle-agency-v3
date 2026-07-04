/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // De embed-widget wordt in iframes van klanten geladen; sta framing toe.
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          // Geen X-Frame-Options DENY op embed-routes; framing wordt per tenant
          // gecontroleerd in productie via Content-Security-Policy frame-ancestors.
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
        ],
      },
    ];
  },
};

export default nextConfig;
