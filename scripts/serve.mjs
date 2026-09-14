/**
 * 零依赖静态服务器 —— 用于本地预览 `dist/` 构建产物
 * 用法：node scripts/serve.mjs [port]
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', 'dist')
const PORT = Number(process.argv[2]) || 4173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html'

    const filePath = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''))
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden')
      return
    }

    const info = await stat(filePath).catch(() => null)
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found')
      return
    }

    const body = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`500 ${err.message}`)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`
  console.log(`[serve] ${url}  (root: ${ROOT})`)

  // --open：起好服务后由 Node 自己拉起默认浏览器。
  // 之所以交给 Node 做，是因为 .bat 里嵌套 start/cmd 引号很容易出问题。
  if (process.argv.includes('--open')) {
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
    const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url]
    try {
      spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
      console.log('[serve] 已尝试打开浏览器')
    } catch (err) {
      console.warn('[serve] 自动打开浏览器失败，请手动访问上面的地址', err.message)
    }
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[serve] 端口 ${PORT} 已被占用——服务可能已经在跑了，直接访问 http://127.0.0.1:${PORT}/`)
    process.exit(2)
  }
  throw err
})
