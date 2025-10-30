const nextConfig = {
  reactStrictMode: true,
  // Ensure server dependencies like chromium are not bundled so their
  // runtime assets (e.g., brotli binaries) resolve from node_modules
  serverExternalPackages: [
    '@sparticuz/chromium',
    'puppeteer-core'
  ],
  // Produce a self-contained server output that plays nicer on Heroku
  output: 'standalone'
};

export default nextConfig;
