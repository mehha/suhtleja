import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Images resizes pictures (src/utilities/imageLoader.ts); the hosts pictures may come
  // from are in wrangler.jsonc. next dev has no /cdn-cgi/image, so it shows pictures as they are.
  images: {
    loader: 'custom',
    loaderFile: './src/utilities/imageLoader.ts',
    unoptimized: process.env.NODE_ENV === 'development',
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  devIndicators: false,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
