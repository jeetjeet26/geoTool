const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // Tell Next to keep these server packages external so their runtime files are preserved
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@sparticuz/chromium', 'puppeteer-core');
    }
    return config;
  }
};

export default nextConfig;
