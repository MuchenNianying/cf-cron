import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  // 处理 VITE_SERVER_URL，提取域名部分作为代理目标
  let proxyTarget = env.VITE_SERVER_URL
  // 如果 VITE_SERVER_URL 包含 /api，去掉它，只使用域名部分
  if (proxyTarget.endsWith('/api')) {
    proxyTarget = proxyTarget.slice(0, -4)
  }
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
