/**
 * 视觉与交互自动核查（开发用）
 * ------------------------------------------------------------
 * 用 Chrome DevTools Protocol 驱动 headless Edge，走一遍完整用户流程并断言：
 *   1. 选已有角色页是否出现 → 截图
 *   2. 点「开始配队」能否进入配队页
 *   3. 鼠标离开配队区时是否自动紧凑、移入时是否展开
 *   4. 角色池卡片 hover 选中态（金描边 / scale / 辉光）
 *   5. 合成 dragstart + dragover 的拖拽悬浮选中态
 *   6. 共鸣模态切换控件是否生效（点右侧徽记 → localStorage 里的模态变化）
 *   7. 点击自动入队（读 localStorage 校验）
 *   8. 底部全队伍预览区 → 截图
 *
 * 用法：node scripts/visual-check.mjs [url] [输出目录]
 *   前置：另开终端跑 `npm run serve`
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(ROOT, process.argv[3] || 'docs/screenshots')
const PORT = 9333
const PROFILE = join(process.env.TEMP || '/tmp', `edge-visual-${Date.now()}`)

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

function findBrowser() {
  if (process.env.EDGE_PATH && existsSync(process.env.EDGE_PATH)) return process.env.EDGE_PATH
  const hit = EDGE_CANDIDATES.find((p) => existsSync(p))
  if (!hit) throw new Error('找不到 Edge/Chrome，可用 EDGE_PATH 环境变量指定')
  return hit
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : res(msg.result)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, reject) => {
      this.pending.set(id, { resolve: res, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP 超时: ${method}`))
        }
      }, 20000)
    })
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'JS 求值失败')
    return r.result?.value
  }

  async shot(file) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(OUT, file), Buffer.from(data, 'base64'))
    console.log(`  📸 ${file}`)
  }

  async move(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  }

  async click(x, y) {
    await this.move(x, y)
    await sleep(90)
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    })
    await sleep(50)
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    })
  }
}

async function waitForTarget(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {
      /* 还没起来 */
    }
    await sleep(250)
  }
  throw new Error('等待 DevTools 目标超时')
}

const RECT = (sel, nth = 0) => `(() => {
  const el = document.querySelectorAll('${sel}')[${nth}];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
           left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
})()`

const results = []
function check(name, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected
  results.push({ name, ok, actual })
  console.log(`  ${ok ? '✓' : '✗'} ${name}：${JSON.stringify(actual)}`)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = findBrowser()
  console.log(`[visual-check] 浏览器 ${browser}\n[visual-check] 目标   ${URL_}\n`)

  const proc = spawn(
    browser,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      '--window-size=1680,1050',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      URL_,
    ],
    { stdio: 'ignore' },
  )

  let cdp
  try {
    const target = await waitForTarget()
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    cdp = new CDP(ws)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Page.navigate', { url: URL_ })
    await sleep(2600)

    /* ---------- 1. 选已有角色页 ---------- */
    console.log('[1] 选已有角色页')
    const ownCount = await cdp.eval(`document.querySelectorAll('.own__cell').length`)
    check('角色选择卡片数量 = 60', ownCount, 60)
    const ownedOff = await cdp.eval(`document.querySelectorAll('.own__cell.is-off').length`)
    check('默认全选（未持有数 = 0）', ownedOff, 0)
    await cdp.shot('check-1-ownership.png')

    /* ---------- 2. 进入配队页 ---------- */
    console.log('\n[2] 开始配队')
    const startBtn = await cdp.eval(`(() => {
      const b = document.querySelector('.own__start');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2), w: Math.round(r.width), h: Math.round(r.height) };
    })()`)
    check('底部「开始配队」按钮足够醒目（高 ≥ 44px）', startBtn?.h ?? 0, (v) => v >= 44)
    await cdp.click(startBtn.x, startBtn.y)
    await sleep(1000)
    const poolCount = await cdp.eval(`document.querySelectorAll('.pool__cell').length`)
    check('角色池出现卡片', poolCount, (v) => typeof v === 'number' && v > 0)

    /* ---------- 3. 配队区：一列多行 + 点击展开 ---------- */
    console.log('\n[3] 配队区（一列多行 / 点击展开）')
    const teamCount = await cdp.eval(`document.querySelectorAll('.team').length`)
    const compactAll = await cdp.eval(`document.querySelectorAll('.team.is-compact').length`)
    check('默认所有队伍都是紧凑态', `${compactAll}/${teamCount}`, () => compactAll === teamCount)
    const col1 = await cdp.eval(
      `getComputedStyle(document.querySelector('.board__grid')).gridTemplateColumns.split(' ').length`,
    )
    check('一列布局（网格仅 1 列）', col1, 1)

    // 用户要求：「重置本期体力」从顶栏挪到队伍区，放在金色布局按钮左侧
    const resetBtn = await cdp.eval(`(() => {
      const box = document.querySelector('.board__actions');
      if (!box) return null;
      const kids = Array.from(box.children);
      const ri = kids.findIndex((b) => b.textContent.includes('重置本期体力'));
      const li = kids.findIndex((b) => b.classList.contains('board__layout'));
      const hd = document.querySelector('.hd');
      return { ri, li, inHeader: hd ? hd.textContent.includes('重置本期体力') : false };
    })()`)
    check('「重置本期体力」在队伍区且位于布局按钮左侧', resetBtn, (v) => !!v && v.ri >= 0 && v.li > v.ri)
    check('顶栏已不再出现「重置本期体力」', resetBtn?.inHeader, false)

    await cdp.shot('check-2-teams-compact.png')

    const t0 = await cdp.eval(RECT('.team'))
    await cdp.click(t0.x, t0.y)
    await sleep(600)
    const firstCompact = await cdp.eval(`document.querySelectorAll('.team')[0].classList.contains('is-compact')`)
    check('点击第 1 支队伍后它展开', firstCompact, false)
    const otherCompact = await cdp.eval(
      `document.querySelectorAll('.team')[1]?.classList.contains('is-compact')`,
    )
    check('其他队伍仍保持紧凑', otherCompact, true)
    await cdp.shot('check-3-teams-expanded.png')

    /* ---------- 3b. 金色按钮切「多列全景」 ---------- */
    console.log('\n[3b] 金色按钮切多列全景')
    await cdp.eval(`document.querySelector('.board__layout').click()`)
    await sleep(600)
    const compactGrid = await cdp.eval(
      `document.querySelectorAll('.team.is-compact').length + '/' + document.querySelectorAll('.team').length`,
    )
    check('多列态下全部为紧凑片', compactGrid, (v) => v.split('/')[0] === v.split('/')[1])
    const col2 = await cdp.eval(
      `getComputedStyle(document.querySelector('.board__grid')).gridTemplateColumns.split(' ').length`,
    )
    check('多列布局生效（≥2 列）', col2, (v) => typeof v === 'number' && v >= 2)
    await cdp.shot('check-3b-grid.png')
    await cdp.eval(`document.querySelector('.board__layout').click()`)
    await sleep(450)

    /* ---------- 4. hover 选中态 ---------- */
    console.log('\n[4] 角色池 hover 选中态')
    const card = await cdp.eval(RECT('.pool__cell', 2))
    await cdp.move(card.x, card.y)
    await sleep(500)
    const hoverSel = await cdp.eval(
      `document.querySelectorAll('.pool__cell .cc')[2]?.classList.contains('is-selected')`,
    )
    check('hover 后出现选中态', hoverSel, true)
    const hoverCss = await cdp.eval(`(() => {
      const el = document.querySelectorAll('.pool__cell .cc')[2];
      const s = getComputedStyle(el);
      return { outline: s.outlineWidth + ' ' + s.outlineColor, transform: s.transform };
    })()`)
    check('金描边为 2px 香槟金', hoverCss.outline, (v) => v.includes('187, 159, 94') && v.includes('2px'))
    check('缩放为 1.06', hoverCss.transform, (v) => v.includes('1.06'))
    await cdp.shot('check-4-hover-goldborder.png')

    /* ---------- 5. drag-over 选中态 ---------- */
    console.log('\n[5] 拖拽悬浮选中态')
    await cdp.eval(`(() => {
      const cells = document.querySelectorAll('.pool__cell');
      const cards = document.querySelectorAll('.pool__cell .cc');
      const dt = new DataTransfer();
      cards[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      cells[6].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      return true;
    })()`)
    await sleep(420)
    const dragSel = await cdp.eval(
      `document.querySelectorAll('.pool__cell .cc')[6]?.classList.contains('is-selected')`,
    )
    check('drag-over 出现选中态', dragSel, true)
    await cdp.eval(
      `document.querySelectorAll('.pool__cell .cc')[0].dispatchEvent(new DragEvent('dragend', { bubbles: true }))`,
    )
    await sleep(280)

    /* ---------- 6. 模态切换控件 ---------- */
    console.log('\n[6] 共鸣模态切换控件')
    const swCount = await cdp.eval(`document.querySelectorAll('.cc__mode-switch').length`)
    check('角色池里存在模态切换控件（应为 4 位）', swCount, 4)
    const beforeMode = await cdp.eval(`JSON.stringify(JSON.parse(localStorage.getItem('wuwa-matrix:v1')).modeSelection)`)
    const swRect = await cdp.eval(RECT('.cc__mode-switch'))
    if (swRect) {
      await cdp.click(swRect.left + swRect.w * 0.9, swRect.top + swRect.h * 0.35)
      await sleep(550)
    }
    const afterMode = await cdp.eval(`JSON.stringify(JSON.parse(localStorage.getItem('wuwa-matrix:v1')).modeSelection)`)
    check('点击右侧徽记后模态被切换', `${beforeMode} → ${afterMode}`, () => beforeMode !== afterMode)

    /* ---------- 7. 点击自动入队 ---------- */
    console.log('\n[7] 点击自动入队')
    const before = await cdp.eval(
      `JSON.parse(localStorage.getItem('wuwa-matrix:v1')).teams.map(t=>t.slots.filter(Boolean).length)`,
    )
    const c4 = await cdp.eval(RECT('.pool__cell', 4))
    await cdp.click(c4.x, c4.y)
    await sleep(650)
    const after = await cdp.eval(
      `JSON.parse(localStorage.getItem('wuwa-matrix:v1')).teams.map(t=>t.slots.filter(Boolean).length)`,
    )
    const sum = (a) => a.reduce((x, y) => x + y, 0)
    check('点击后队伍总人数 +1', `${JSON.stringify(before)} → ${JSON.stringify(after)}`, () => sum(after) === sum(before) + 1)

    /* ---------- 7b. 填满自动补队 + 用尽角色下架 ---------- */
    console.log('\n[7b] 队伍填满后自动新增空队伍 / 用尽角色下架')
    const teamLen = () => cdp.eval(`JSON.parse(localStorage.getItem('wuwa-matrix:v1')).teams.length`)
    const startTeams = await teamLen()
    // 注意：①角色用尽后会从池中移除，索引会前移 —— 每次都从第 0 张试；
    //       ②体力 2 的角色用过一次仍留在池里，若它已在唯一有空位的队伍中，
    //         再点它无处可去（应用会弹提示）—— 这不算失败，换下一张继续；
    //       ③停止条件是「冒出了新队伍」，不是「所有队伍都满」（新队伍是空的，永远不满）。
    const sumTeams = () =>
      cdp.eval(
        `JSON.parse(localStorage.getItem('wuwa-matrix:v1')).teams.reduce((a,t)=>a+t.slots.filter(Boolean).length,0)`,
      )
    let guard = 0
    let probe = 0
    let fails = 0
    while ((await teamLen()) === startTeams && guard++ < 80 && fails < 5) {
      const r = await cdp.eval(RECT('.pool__cell', probe))
      if (!r) {
        probe = 0
        fails += 1
        continue
      }
      const n0 = await sumTeams()
      await cdp.click(r.x, r.y)
      await sleep(260)
      const n1 = await sumTeams()
      if (n1 === n0) {
        fails += 1
        probe += 1
      } else {
        fails = 0
        probe = 0
      }
    }
    const teamsNow = await cdp.eval(
      `JSON.parse(localStorage.getItem('wuwa-matrix:v1')).teams.map(t=>t.slots.filter(Boolean).length)`,
    )
    check(
      '填满后自动追加了空队伍',
      JSON.stringify(teamsNow),
      (v) => {
        const arr = JSON.parse(v)
        return (
          arr.length === startTeams + 1 &&
          arr.slice(0, -1).every((n) => n === 3) &&
          arr[arr.length - 1] === 0
        )
      },
    )
    const hasAddBtn = await cdp.eval(
      `!!Array.from(document.querySelectorAll('.board button')).find(b=>b.textContent.includes('新建队伍'))`,
    )
    check('手动「新建队伍」按钮已移除', hasAddBtn, false)

    // v0.2：体力用尽的角色应当从池中下架，而不是留一张灰卡让人来回翻
    const exhaustedInPool = await cdp.eval(
      `document.querySelectorAll('.pool__cell .cc.is-exhausted').length`,
    )
    check('用尽体力的角色已从池中移出（池内无灰卡）', exhaustedInPool, 0)
    const exhaustTag = await cdp.eval(
      `(() => { const el = document.querySelector('.pool__exhausted'); return el ? el.textContent.trim() : null })()`,
    )
    check('给出了「已用尽移出 N」的提示', exhaustTag, (v) => typeof v === 'string' && v.includes('已用尽移出'))

    /* ---------- 7c. 点立绘 = 放回角色池，且不收缩 ---------- */
    console.log('\n[7c] 点队伍里的立绘 → 放回角色池')
    const teamTotal = await cdp.eval(`document.querySelectorAll('.team').length`)
    // 先把所有展开的队伍收起来（点它队头的非立绘区域）
    for (let i = 0; i < 4; i++) {
      const c = await cdp.eval(`document.querySelectorAll('.team.is-compact').length`)
      if (c === teamTotal) break
      const h = await cdp.eval(RECT('.team:not(.is-compact) .team__count'))
      if (!h) break
      await cdp.click(h.x, h.y)
      await sleep(420)
    }
    const compactBefore = await cdp.eval(`document.querySelectorAll('.team.is-compact').length`)
    check('点击队头空白区域可收起队伍', `${compactBefore}/${teamTotal}`, () => compactBefore === teamTotal)

    const nBefore = await sumTeams()
    const chip = await cdp.eval(RECT('.team .chip'))
    check('紧凑态里能看到角色头像片', !!chip, true)
    if (chip) {
      await cdp.click(chip.x, chip.y)
      await sleep(600)
    }
    const nAfter = await sumTeams()
    check('点击立绘把角色放回了池子（队伍人数 -1）', `${nBefore} → ${nAfter}`, () => nAfter === nBefore - 1)
    const compactAfter = await cdp.eval(`document.querySelectorAll('.team.is-compact').length`)
    check('点击立绘不会展开该队伍（仍全部紧凑）', `${compactAfter}/${teamTotal}`, () => compactAfter === teamTotal)

    /* ---------- 8. 全队预览（v0.3：底部预览区已并进队伍区） ---------- */
    console.log('\n[8] 全队预览已并进队伍区')
    const tpGone = await cdp.eval(`document.querySelectorAll('.tp__team, .app__preview').length`)
    check('底部「全队伍预览区」已移除', tpGone, 0)
    const gridBtn = await cdp.eval(`document.querySelector('.board__layout')?.textContent.trim()`)
    check('按钮文案为「切换全队预览」', gridBtn, (v) => typeof v === 'string' && v.includes('切换全队预览'))
    await cdp.eval(`document.querySelector('.board__layout').click()`)
    await sleep(600)
    const backBtn = await cdp.eval(`document.querySelector('.board__layout')?.textContent.trim()`)
    check('切过去后按钮文案为「切换配队页面」', backBtn, (v) => typeof v === 'string' && v.includes('切换配队页面'))
    await cdp.shot('check-5-team-preview.png')
    await cdp.eval(`document.querySelector('.board__layout').click()`)
    await sleep(500)

    /* ---------- 8b. v0.5/v0.6：主题图标 / 换序插入线的【实际渲染位置】 ---------- */
    console.log('\n[8b] v0.5/v0.6：主题图标 / 换序插入线实际位置')
    const themeImg = await cdp.eval(
      `document.querySelector('.hd__brand .hd__theme img')?.getAttribute('src') || ''`,
    )
    check('明暗切换用的是图标素材', themeImg, (v) => typeof v === 'string' && v.includes('/assets/theme/'))

    const teamNames = () =>
      cdp.eval(`JSON.parse(localStorage.getItem('wuwa-matrix:v1')).teams.map(t=>t.name)`)
    const namesBefore = await teamNames()

    /** 合成一次「拖第 from 支队伍的握把 → 在 over 支队伍 ratio 比例高度处 dragover」 */
    const synthDrag = (from, over, ratio) =>
      cdp.eval(`(() => {
        const grips = document.querySelectorAll('.team__grip');
        const teams = document.querySelectorAll('.team');
        if (!grips[${from}] || !teams[${over}]) return false;
        const dt = new DataTransfer();
        grips[${from}].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        const r = teams[${over}].getBoundingClientRect();
        teams[${over}].dispatchEvent(new DragEvent('dragover', {
          bubbles: true, cancelable: true, dataTransfer: dt,
          clientX: Math.round(r.left + r.width / 2),
          clientY: Math.round(r.top + r.height * ${ratio}),
        }));
        return true;
      })()`)

    /** 读出插入线与各队伍的实测几何（这是本项的关键：断言位置而不是 class 名） */
    const geom = () =>
      cdp.eval(`(() => {
        const pick = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
          return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left),
                   right: Math.round(b.right), cy: Math.round(b.top + b.height / 2) }; };
        return JSON.stringify({
          line: pick(document.querySelector('.board__dropline')),
          grid: pick(document.querySelector('.board__grid')),
          head: pick(document.querySelector('.board__head')),
          teams: [...document.querySelectorAll('.team')].map(pick),
        });
      })()`)

    // ① 悬停第 3 队上半区 → 线应落在「第 2 队下沿 ~ 第 3 队上沿」之间
    await synthDrag(0, 2, 0.12)
    await sleep(360)
    let g = JSON.parse(await geom())
    check('插入线元素存在', !!g.line, true)
    const lineY = async () => {
      const o = JSON.parse(await geom())
      return o.line ? o.line.cy : null
    }

    // ① 悬停第 3 队上半区 → 插入点 k=2 → 线落在「第2队下沿 ~ 第3队上沿」的间隙正中
    await synthDrag(0, 2, 0.12)
    await sleep(360)
    g = JSON.parse(await geom())
    const gapCenter12 = Math.round((g.teams[1].bottom + g.teams[2].top) / 2)
    check(
      '① 线落在第 2/3 队之间的间隙正中（±4px）',
      JSON.stringify({ line: g.line?.cy, expect: gapCenter12, gap: g.teams[2].top - g.teams[1].bottom }),
      () => !!g.line && Math.abs(g.line.cy - gapCenter12) <= 4,
    )
    check(
      '线横跨整个网格宽度',
      JSON.stringify({ l: g.line && [g.line.left, g.line.right], gr: g.grid && [g.grid.left, g.grid.right] }),
      () => !!g.line && g.line.left === g.grid.left && g.line.right === g.grid.right,
    )
    check(
      '线在网格内部、没有被挤出到「队伍区」标题上方',
      JSON.stringify({ lineTop: g.line?.top, gridTop: g.grid?.top, headBottom: g.head?.bottom }),
      () => !!g.line && g.line.top >= g.grid.top - 2 && g.line.top >= g.head.bottom - 2,
    )
    check(
      '被拖过的编队本身没有外框/发光（只留横线）',
      await cdp.eval(`(() => { const s = getComputedStyle(document.querySelectorAll('.team')[2]);
        return s.boxShadow === 'none' || s.boxShadow === ''; })()`),
      true,
    )
    await cdp.shot('check-8-drop-line-before.png')

    // ② 悬停第 3 队下半区 → k=3 → 线落在第3队与第4队（若只有3队则是末尾）之间
    await synthDrag(0, 2, 0.88)
    await sleep(360)
    g = JSON.parse(await geom())
    const lastBottom = g.teams[g.teams.length - 1].bottom
    check(
      '② 悬停第 3 队下半区 → 线落到第 3 队之后再往后（±4px）',
      JSON.stringify({ line: g.line?.cy, t2bottom: g.teams[2].bottom }),
      () => !!g.line && g.line.cy >= g.teams[2].bottom - 4,
    )
    void lastBottom

    // ③ 【v0.7 核心回归】同一个插入点、从相邻两队分别触发，线的位置必须完全一致
    //    这正是 v0.6「金线在队伍边框来回跳」的病灶：旧实现用的是被悬停队伍的上/下沿，
    //    悬停 A 的下半区取 A.bottom、悬停 B 的上半区取 B.top，两者相差一个网格间隙。
    await synthDrag(0, 1, 0.9) // 悬停第 2 队下半区 → k=2
    await sleep(320)
    const yFromPrevLower = await lineY()
    await synthDrag(0, 2, 0.1) // 悬停第 3 队上半区 → 同样是 k=2
    await sleep(320)
    const yFromNextUpper = await lineY()
    check(
      '③ 同一插入点，从「上一队下半区」与「下一队上半区」触发时线的位置完全一致（不再来回跳）',
      `${yFromPrevLower} vs ${yFromNextUpper}`,
      () => yFromPrevLower !== null && yFromPrevLower === yFromNextUpper,
    )

    // ③b 同一半区内微调鼠标位置，线也不应移动
    await synthDrag(0, 2, 0.25)
    await sleep(300)
    const yUpperA = await lineY()
    await synthDrag(0, 2, 0.45)
    await sleep(300)
    const yUpperB = await lineY()
    check(
      '③b 鼠标在同一半区内轻微移动时线纹丝不动',
      `${yUpperA} vs ${yUpperB}`,
      () => yUpperA !== null && yUpperA === yUpperB,
    )

    // ④ 拖到【最上方】时线不能跑到「队伍区」标题上方
    await synthDrag(1, 0, 0.1)
    await sleep(360)
    g = JSON.parse(await geom())
    check(
      '④ 拖到最上方时，线在第 1 队上沿且仍在「队伍区」标题下方',
      JSON.stringify({ line: g.line?.cy, t0top: g.teams[0]?.top, headBottom: g.head?.bottom }),
      () => !!g.line && Math.abs(g.line.cy - g.teams[0].top) <= 4 && g.line.top >= g.head.bottom - 2,
    )
    await cdp.shot('check-8-drop-line-top.png')

    // ⑤ 落点等于原位时不画线（拖第 2 队、悬停自己）
    await synthDrag(1, 1, 0.5)
    await sleep(320)
    check('落点等于原位时不画线', await cdp.eval(`!!document.querySelector('.board__dropline')`), false)

    // ⑥ 落下后顺序正确：拖第1队到第2/3队之间 → [2,1,3]
    await synthDrag(0, 2, 0.12)
    await sleep(300)
    await cdp.eval(`(() => {
      const teams = document.querySelectorAll('.team');
      const dt = new DataTransfer();
      teams[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      return true;
    })()`)
    await sleep(600)
    const namesAfter = await teamNames()
    check(
      '⑥ 落下后顺序正确（第1队插到第2、3队之间）',
      `${JSON.stringify(namesBefore)} → ${JSON.stringify(namesAfter)}`,
      () => {
        const b = namesBefore
        const a = namesAfter
        return JSON.stringify(a) === JSON.stringify([b[1], b[0], b[2]])
      },
    )
    check('落下后插入线消失', await cdp.eval(`!!document.querySelector('.board__dropline')`), false)

    /* ---------- 9. v0.4：重置收敛 / 期次居中 / 主题按钮归位 / 焦点队伍 ---------- */
    console.log('\n[9] v0.4：重置收敛 / 期次居中 / 主题按钮归位 / 焦点队伍')
    check(
      '明暗切换按钮已挪到左侧标题区',
      await cdp.eval(`!!document.querySelector('.hd__brand .hd__theme')`),
      true,
    )
    check(
      '右侧操作区不再有明暗切换',
      await cdp.eval(`!!document.querySelector('.hd__actions .hd__theme')`),
      false,
    )
    const periodText = await cdp.eval(`document.querySelector('.hd__period')?.textContent.trim()`)
    check('期次不再带「本期」字样', periodText, (v) => typeof v === 'string' && !v.includes('本期') && v.length > 0)
    const centered = await cdp.eval(`(() => {
      const el = document.querySelector('.hd__period'); const hd = document.querySelector('.hd');
      if (!el || !hd) return null;
      const a = el.getBoundingClientRect(), b = hd.getBoundingClientRect();
      return Math.round(Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)));
    })()`)
    check('期次水平居中（偏差 < 4px）', centered, (v) => typeof v === 'number' && v < 4)

    // 点击入队 → 收到角色的那支队伍成为焦点，其他收缩
    const snapshotTeams = () =>
      cdp.eval(
        `JSON.stringify((() => { const s = JSON.parse(localStorage.getItem('wuwa-matrix:v1')); return { ids: s.teams.map(t=>t.id), slots: s.teams.map(t=>t.slots), focus: s.selectedTeamId }; })())`,
      )
    const snapBefore = JSON.parse(await snapshotTeams())
    const pc0 = await cdp.eval(RECT('.pool__cell', 0))
    if (pc0) {
      await cdp.click(pc0.x, pc0.y)
      await sleep(650)
    }
    const snapAfter = JSON.parse(await snapshotTeams())
    const changedIdx = snapAfter.slots.findIndex(
      (slots, i) => JSON.stringify(slots) !== JSON.stringify(snapBefore.slots[i]),
    )
    check(
      '点击入队后【收到角色的那支队伍】成为焦点',
      `变化队伍=${changedIdx} 焦点=${snapAfter.ids.indexOf(snapAfter.focus)}`,
      () => changedIdx >= 0 && snapAfter.ids[changedIdx] === snapAfter.focus,
    )
    check(
      '只有焦点队伍处于展开态',
      await cdp.eval(`document.querySelectorAll('.team:not(.is-compact)').length`),
      1,
    )
    await cdp.shot('check-7-focus-team.png')

    // 重置本期体力 → 空队伍删除、收敛成一支「配队1」
    await cdp.eval(`window.confirm = () => true`)
    const resetRect = await cdp.eval(RECT('.board__actions button', 0))
    if (resetRect) {
      await cdp.click(resetRect.x, resetRect.y)
      await sleep(800)
    }
    const teamsAfterReset = await cdp.eval(
      `JSON.parse(localStorage.getItem('wuwa-matrix:v1')).teams.map(t=>t.name)`,
    )
    check('重置后只剩一支队伍且名为「配队1」', JSON.stringify(teamsAfterReset), (v) => {
      const a = JSON.parse(v)
      return a.length === 1 && a[0] === '配队1'
    })

    /* ---------- 10. v0.3 精简 / 管理员门禁 / 强化浮层 ---------- */
    console.log('\n[10] v0.3：界面精简 / 管理员门禁 / 强化浮层')
    const hdText = await cdp.eval(`document.querySelector('.hd').textContent`)
    check('顶栏不再显示「强化 N」', /强化\s*\d/.test(hdText), false)
    check('顶栏不再显示槽位/入队统计', !/槽位/.test(hdText) && !/角色已入队/.test(hdText), true)
    check('期次为只读文本（顶栏无 select）', await cdp.eval(`!document.querySelector('.hd select')`), true)
    check('队伍卡已无右上角红叉', await cdp.eval(`document.querySelectorAll('.team__remove').length`), 0)
    check('队伍卡已无展开箭头', await cdp.eval(`document.querySelectorAll('.team__caret').length`), 0)
    check(
      '角色卡不再挂原生 title（去掉 hover 时的 web 字段描述）',
      await cdp.eval(`!!document.querySelector('.pool__cell .cc[title]')`),
      false,
    )
    check(
      '紧凑头像片不再挂「名字｜属性」字段描述',
      await cdp.eval(
        `!!document.querySelector('.team .chip[title]') && /｜/.test(document.querySelector('.team .chip[title]').getAttribute('title') || '')`,
      ),
      false,
    )

    // 管理员门禁：只有 URL 带 #admin 才出现后台入口
    check('默认不显示「后台管理」入口', await cdp.eval(`!!document.querySelector('.hd__admin')`), false)
    await cdp.eval(`location.hash = '#admin'`)
    await sleep(700)
    check('访问 #admin 后出现后台管理入口', await cdp.eval(`!!document.querySelector('.hd__admin')`), true)
    const drawerOpened = await cdp.eval(`!!document.querySelector('.drawer')`)
    check('#admin 会自动打开后台面板', drawerOpened, true)
    await cdp.eval(`document.querySelector('.drawer__x')?.click()`)
    await sleep(300)
    await cdp.eval(`location.hash = ''`)
    await sleep(600)
    check('去掉 #admin 后入口与面板都消失', await cdp.eval(`!!document.querySelector('.hd__admin')`), false)

    // 强化浮层：往存档里塞一条强化，刷新后悬停角标应能看到说明
    await cdp.eval(`(() => {
      const s = JSON.parse(localStorage.getItem('wuwa-matrix:v1'));
      const ids = s.characters.slice(0, 8).map((c) => c.id);
      s.enhancements[s.currentPeriodId] = Object.fromEntries(
        ids.map((id) => [id, [{ id: 'regression', text: '伤害上升 20%', staminaPlus: 0 }]]),
      );
      // ⚠️ 必须同时置 configDirty，否则刷新时会被仓库配置（docs/periods.json）覆盖掉
      s.configDirty = true;
      localStorage.setItem('wuwa-matrix:v1', JSON.stringify(s));
      return ids.length;
    })()`)
    await cdp.send('Page.navigate', { url: URL_ })
    await sleep(2800)
    const enhBadge = await cdp.eval(`document.querySelectorAll('.cc__enh').length`)
    const enhPop = await cdp.eval(`document.querySelectorAll('.cc__enh .cc__enh-pop').length`)
    check('强化角标存在', enhBadge, (v) => typeof v === 'number' && v > 0)
    check('强化角标带说明浮层', enhPop, (v) => typeof v === 'number' && v > 0)
    const popText = await cdp.eval(`document.querySelector('.cc__enh-pop')?.textContent.replace(/\\s+/g,' ').trim()`)
    check('浮层文案含「本期强化」与具体内容', popText, (v) => typeof v === 'string' && v.includes('本期强化'))
    await cdp.shot('check-6-enh-popover.png')

    /* ---------- 11. v0.7：后台精简 / 强化删除 / 模态配置 / 导出角色表 ---------- */
    console.log('\n[11] v0.7：后台精简 / 强化删除 / 模态配置 / 导出角色表')

    /** 给 Vue 的 v-model 输入框赋值（要走 native setter，否则不触发响应式） */
    const setInput = (sel, value) =>
      cdp.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`)
    const clickByText = (sel, text) =>
      cdp.eval(`(() => {
        const el = [...document.querySelectorAll(${JSON.stringify(sel)})]
          .find((b) => b.textContent.includes(${JSON.stringify(text)}));
        if (!el) return false;
        el.click();
        return true;
      })()`)
    const enhCount = () =>
      cdp.eval(`(() => {
        const s = JSON.parse(localStorage.getItem('wuwa-matrix:v1'));
        const cur = s.enhancements[s.currentPeriodId] || {};
        return Object.values(cur).reduce((a, l) => a + l.length, 0);
      })()`)

    await cdp.eval(`location.hash = '#admin'`)
    await sleep(900)
    // ⚠️ 步骤 10 里 Page.navigate 过，页面级覆盖已失效 —— 不重新盖住 confirm，
    //    点「全部删除」会弹出真模态框，headless 下没人应答，CDP 直接卡到超时。
    await cdp.eval(`window.confirm = () => true; window.alert = () => {};`)
    const drawerText = await cdp.eval(`document.querySelector('.drawer')?.textContent || ''`)
    check('后台不再有「本地工具 · 无需口令」冗余文字', drawerText.includes('无需口令'), false)

    await clickByText('.drawer__tab', '期次编辑')
    await sleep(400)
    const tabNames = await cdp.eval(
      `[...document.querySelectorAll('.drawer__tab')].map(b=>b.textContent.trim()).join('|')`,
    )
    check(
      'Tab 名为「期次编辑」且不再叫「期次与体力」',
      tabNames,
      (v) => v.includes('期次编辑') && !v.includes('期次与体力'),
    )
    const periodBody = await cdp.eval(`document.querySelector('.drawer__body')?.textContent || ''`)
    check('期次页不再包含体力管理模块', periodBody.includes('一键重置当期体力'), false)

    // 本期强化：添加 → 删除（v0.7 修的 bug）
    await clickByText('.drawer__tab', '本期强化')
    await sleep(400)
    const enhBefore = await enhCount()
    await setInput('.enh__text', '回归测试用强化')
    await sleep(150)
    await clickByText('.drawer__body .btn--primary', '添加')
    await sleep(450)
    const enhAdded = await enhCount()
    check('能添加一条强化', `${enhBefore} → ${enhAdded}`, () => enhAdded === enhBefore + 1)
    await clickByText('.enh-list__li .btn--danger', '删除')
    await sleep(450)
    const enhDeleted = await enhCount()
    check('能从「当前强化」里删除这条（v0.7 修复的 bug）', `${enhAdded} → ${enhDeleted}`, () => enhDeleted === enhBefore)

    // 汇总列表：单条删除 + 全部删除
    await setInput('.enh__text', '甲')
    await sleep(120)
    await clickByText('.drawer__body .btn--primary', '添加')
    await sleep(300)
    await setInput('.enh__text', '乙')
    await sleep(120)
    await clickByText('.drawer__body .btn--primary', '添加')
    await sleep(400)
    const twoAdded = await enhCount()
    check('汇总列表前先有 2 条', twoAdded, (v) => v >= 2)
    await clickByText('.enh-sum__item .btn--danger', '删除')
    await sleep(400)
    check('汇总列表里能删单条', await enhCount(), (v) => v === twoAdded - 1)
    check('「全部删除」按钮存在', await clickByText('.enh-sum__clear', '全部删除'), true)
    await sleep(500)
    check('「全部删除」清空本期强化', await enhCount(), 0)

    // 模态配置
    await clickByText('.drawer__tab', '角色管理')
    await sleep(500)
    const optCount = await cdp.eval(`document.querySelectorAll('.mode__opt').length`)
    check('模态配置为每位角色提供 5 个可选模态', optCount, (v) => typeof v === 'number' && v > 0 && v % 5 === 0)
    const modesBefore = await cdp.eval(
      `JSON.stringify(JSON.parse(localStorage.getItem('wuwa-matrix:v1')).characters.find(c=>c.id==='emis')?.modes || [])`,
    )
    await cdp.eval(`(() => {
      const rows = [...document.querySelectorAll('.charlist__li')];
      const row = rows.find((r) => r.textContent.includes('爱弥斯'));
      if (!row) return false;
      const opt = [...row.querySelectorAll('.mode__opt')].find((b) => !b.classList.contains('is-on'));
      if (!opt) return false;
      opt.click();
      return true;
    })()`)
    await sleep(500)
    const modesAfter = await cdp.eval(
      `JSON.stringify(JSON.parse(localStorage.getItem('wuwa-matrix:v1')).characters.find(c=>c.id==='emis')?.modes || [])`,
    )
    check(
      '点模态标签即可给角色【新增】一个模态',
      `${modesBefore} → ${modesAfter}`,
      () => JSON.parse(modesAfter).length === JSON.parse(modesBefore).length + 1,
    )
    check('「导出角色表 (.xlsx)」按钮存在', await cdp.eval(`!!document.querySelector('.sec .btn--primary')`), true)
    const hasXlsxBtn = await cdp.eval(
      `[...document.querySelectorAll('.drawer .btn')].some((b) => b.textContent.includes('导出角色表'))`,
    )
    check('导出按钮文案正确', hasXlsxBtn, true)

    await cdp.shot('check-9-admin.png')
    await cdp.eval(`location.hash = ''`)
    await sleep(400)

    /* ---------- 12. 期次配置发布通道（docs/periods.json） ---------- */
    console.log('\n[12] 期次配置发布通道')
    const lsState = () => cdp.eval(`JSON.parse(localStorage.getItem('wuwa-matrix:v1') || '{}')`)
    const reload = async () => {
      await cdp.send('Page.navigate', { url: URL_ })
      await sleep(2600)
      await cdp.eval(`window.confirm = () => true; window.alert = () => {};`)
    }
    const enhTotal = () =>
      cdp.eval(`(() => {
        const s = JSON.parse(localStorage.getItem('wuwa-matrix:v1'));
        const cur = s.enhancements[s.currentPeriodId] || {};
        return Object.values(cur).reduce((a, l) => a + l.length, 0);
      })()`)

    // 前面的步骤改过配置 → 先还原成「访客首次打开」的状态再断言
    await cdp.eval(`(() => {
      const s = JSON.parse(localStorage.getItem('wuwa-matrix:v1'));
      s.configDirty = false;
      s.enhancements = {};
      localStorage.setItem('wuwa-matrix:v1', JSON.stringify(s));
      return true;
    })()`)
    await reload()

    const seeded = await lsState()
    check(
      '期次来自仓库配置 docs/periods.json',
      JSON.stringify({ id: seeded.currentPeriodId, name: seeded.periods?.[0]?.name }),
      (v) => {
        const o = JSON.parse(v)
        return o.id === 'p1' && o.name === '第 1 期'
      },
    )
    check('访客态 configDirty 为 false', seeded.configDirty === true, false)

    await cdp.eval(`location.hash = '#admin'`)
    await sleep(800)
    await cdp.eval(`window.confirm = () => true; window.alert = () => {};`)
    await clickByText('.drawer__tab', '期次编辑')
    await sleep(400)
    const pubText = await cdp.eval(`document.querySelector('.pub')?.textContent || ''`)
    check('有「发布到线上」提示块与导出按钮', pubText.includes('导出期次配置'), true)
    check('未改动时显示「与仓库配置一致」', pubText.includes('与仓库配置一致'), true)

    // 改一条强化 → configDirty 应变 true
    await clickByText('.drawer__tab', '本期强化')
    await sleep(400)
    await setInput('.enh__text', '发布通道测试用')
    await sleep(150)
    await clickByText('.drawer__body .btn--primary', '添加')
    await sleep(500)
    check('改动强化后 configDirty 变 true', (await lsState()).configDirty, true)
    await clickByText('.drawer__tab', '期次编辑')
    await sleep(400)
    check('状态标签变为「有未发布的改动」', await cdp.eval(`!!document.querySelector('.pub__dirty')`), true)
    check(
      '出现「放弃本地改动」按钮',
      await cdp.eval(
        `[...document.querySelectorAll('.pub .btn')].some(b=>b.textContent.includes('放弃本地改动'))`,
      ),
      true,
    )
    await cdp.shot('check-10-publish-channel.png')

    // configDirty=true 时刷新 → 本地改动保留（运营能继续编辑）
    await reload()
    check('configDirty=true 时刷新保留本地强化', await enhTotal(), (v) => v >= 1)

    // 模拟访客态（configDirty=false）刷新 → 仓库配置覆盖本地
    await cdp.eval(`(() => {
      const s = JSON.parse(localStorage.getItem('wuwa-matrix:v1'));
      s.configDirty = false;
      localStorage.setItem('wuwa-matrix:v1', JSON.stringify(s));
      return true;
    })()`)
    await reload()
    check('configDirty=false 时刷新，仓库配置覆盖本地（访客总拿到最新一期）', await enhTotal(), 0)
    await cdp.shot('check-11-repo-config-wins.png')

    /* ---------- 汇总 ---------- */
    const failed = results.filter((r) => !r.ok)
    console.log(
      `\n[visual-check] ${failed.length ? `⚠️ ${failed.length} 项未达预期` : '✅ 全部通过'}（共 ${results.length} 项）`,
    )
    for (const f of failed) console.log(`   ✗ ${f.name} → ${JSON.stringify(f.actual)}`)
    process.exitCode = failed.length ? 2 : 0
  } finally {
    try {
      cdp?.ws.close()
    } catch {
      /* ignore */
    }
    proc.kill()
  }
}

main().catch((err) => {
  console.error('[visual-check] 失败：', err.message)
  process.exitCode = 1
})
