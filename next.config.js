/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse']
  },
  // APIルートの設定を削除（App Routerでは無効）
}

module.exports = nextConfig