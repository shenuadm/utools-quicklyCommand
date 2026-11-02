import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 生产构建时剥离 plugin.json 中的 development 字段。
 *
 * development.main 指向本地 Vite 开发服务器，仅在开发者工具「安装（开发模式）」
 * 下有意义；若随插件一起发布，终端用户会得到一个指向 localhost 的死链。
 */
function utoolsPlugin() {
  return {
    name: 'utools:strip-development',
    apply: 'build',
    closeBundle() {
      const file = path.resolve(process.cwd(), 'dist/plugin.json')
      if (!fs.existsSync(file)) return
      const json = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (!json.development) return
      delete json.development
      fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf-8')
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), utoolsPlugin()],
  base: './',
  server: {
    // 与 public/plugin.json 中的 development.main 保持一致
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    chunkSizeWarningLimit: 1500
  }
})
