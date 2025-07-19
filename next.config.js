/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental.serverComponentsExternalPackages を serverExternalPackages に変更
  serverExternalPackages: ['canvas', 'pdfjs-dist'],
  
  // Vercelでのファイルサイズ制限を回避するための設定
  experimental: {
    // 必要に応じて他のexperimental設定をここに追加
  },
  
  // API routesのbody parser制限を拡張
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  
  // Webpack設定でpdf.jsの問題を解決
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    
    // pdf.jsのworkerファイルを正しく処理
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist/build/pdf.worker.js': 'pdfjs-dist/build/pdf.worker.min.js',
    };
    
    return config;
  },
  
  // 静的ファイルの処理を改善
  async rewrites() {
    return [
      {
        source: '/pdf.worker.js',
        destination: '/_next/static/chunks/pdf.worker.js'
      }
    ];
  }
};

module.exports = nextConfig;