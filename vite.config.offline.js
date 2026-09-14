/**
 * 「免安装版」构建配置
 * ------------------------------------------------------------
 * 与主构建的区别只有一个目标：让产物能在 **file:// 协议下直接双击打开**。
 * 默认构建是 ES Module，浏览器在 file:// 下会按 CORS 策略拦掉 <script type="module">，
 * 因此这里：
 *   1. 输出 IIFE 格式（普通脚本，无模块加载）
 *   2. 关掉 code splitting / modulePreload
 *   3. 构建后用一个小插件把 index.html 里的 type="module" 与 crossorigin 去掉
 * 图片走 CSS background-image，file:// 下不受 CORS 限制，因此无需内联。
 *
 * 用法：npx vite build --config vite.config.offline.js
 * 产物：dist-offline/
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/** 去掉 <script type="module"> 的模块属性，让普通 <script> 也能加载 */
function stripModuleAttr() {
  return {
    name: 'offline-strip-module',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          // 模块脚本天然 defer；改成普通脚本后必须显式加 defer，
          // 否则它在 <head> 里同步执行，此时 #app 还不存在，Vue 会静默挂载失败。
          .replace(/<script type="module" crossorigin/g, '<script defer')
          .replace(/<script type="module"/g, '<script defer')
          .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
          // file:// 下带 crossorigin 的 <link> 会走 CORS 校验而失败，一并去掉
          .replace(/ crossorigin(?=[\s>])/g, '')
      },
    },
  }
}

export default defineConfig({
  plugins: [vue(), stripModuleAttr()],
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist-offline',
    assetsDir: 'static',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    target: 'es2018',
    rollupOptions: {
      input: { main: fileURLToPath(new URL('./index.html', import.meta.url)) },
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'static/app.js',
        assetFileNames: 'static/app.[ext]',
      },
    },
  },
})
