/**
 * 一次性诊断：用 CDP 打开任意 URL，把控制台消息与页面错误打出来。
 * 用法：node scripts/debug-page.mjs <url>
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_ = process.argv[2]
if (!URL_) {
  console.error('用法：node scripts/debug-page.mjs <url>')
  process.exit(1)
}

const PORT = 9444
const PROFILE = join(process.env.TEMP || '/tmp', `edge-debug-${Date.now()}`)
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p))

const proc = spawn(
  EDGE,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1200,800',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    URL_,
  ],
  { stdio: 'ignore' },
)

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (p) return p
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  throw new Error('等不到调试目标')
}

try {
  const t = await target()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })

  let id = 0
  const send = (method, params = {}) =>
    new Promise((res) => {
      const myId = ++id
      const onMsg = (ev) => {
        const m = JSON.parse(ev.data)
        if (m.id === myId) {
          ws.removeEventListener('message', onMsg)
          res(m.result)
        }
      }
      ws.addEventListener('message', onMsg)
      ws.send(JSON.stringify({ id: myId, method, params }))
    })

  const logs = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      logs.push(`[异常] ${d.text} ${d.exception?.description || ''}`)
    }
    if (m.method === 'Log.entryAdded') {
      logs.push(`[${m.params.entry.level}] ${m.params.entry.text}`)
    }
  })

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Page.navigate', { url: URL_ })
  await sleep(4000)

  const info = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      title: document.title,
      appHtmlLen: (document.getElementById('app')||{}).innerHTML?.length ?? -1,
      scripts: [...document.scripts].map(s=>s.src||'(inline)'),
      sheets: [...document.styleSheets].map(s=>s.href||'(inline)'),
      baseUrl: document.baseURI,
      lsError: (()=>{ try { localStorage.getItem('x'); return 'ok' } catch(e){ return e.name + ': ' + e.message } })()
    })`,
    returnByValue: true,
  })

  console.log('=== 页面信息 ===')
  console.log(JSON.stringify(JSON.parse(info.result.value), null, 2))
  console.log('\n=== 控制台 / 异常 ===')
  console.log(logs.length ? logs.join('\n') : '(无)')
  ws.close()
} finally {
  proc.kill()
}
