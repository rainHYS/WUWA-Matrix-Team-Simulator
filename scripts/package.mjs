/**
 * 发布打包：生成可分发的 zip
 * ------------------------------------------------------------
 * 结构：
 *   鸣潮矩阵配队模拟器-v<版本>/
 *     index.html / static/ / assets/   ← 免安装版，双击 index.html 即可运行（无需 Node）
 *     使用说明.txt
 *     源码/                            ← 完整可开发工程（需 Node）
 *
 * 用法：node scripts/package.mjs
 */
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
/** 文件名用 v0.1 这种两位版本号（去掉补丁位） */
const VERSION = `v${pkg.version.split('.').slice(0, 2).join('.')}`

const NAME = `鸣潮矩阵配队模拟器-${VERSION}`
const STAGE = join(ROOT, '_pkg')
const DIST = join(STAGE, NAME)
const OUT_ZIP = join(ROOT, `${NAME}.zip`)

/** 源码包里要带的东西 */
const SOURCE_ITEMS = [
  'src',
  'scripts',
  'docs/characters.json',
  'docs/periods.json',
  'docs/db-schema.sql',
  '图片素材',
  'index.html',
  'card-preview.html',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'vite.config.offline.js',
  '启动模拟器.bat',
  'README.md',
  '需求整理.md',
  '.gitignore',
]

function log(msg) {
  console.log(`[package] ${msg}`)
}

const USAGE = `鸣潮·终焉矩阵配队模拟器 ${VERSION}
================================================

【怎么用 —— 不用装任何东西】

  双击本文件夹里的  index.html   即可。
  用 Edge / Chrome 打开都行，不需要联网、不需要装 Node。

  注意：如果你用的是 Firefox，file:// 下可能有限制，建议改用 Edge/Chrome；
        或者用「源码」文件夹里的 启动模拟器.bat 起本地服务再访问。


【上手流程】

  1. 选已有角色：首屏按属性分好组，默认全选。没有的角色点一下取消，
     然后点右下角金色的「开始配队」。
  2. 配队：右侧角色池「点一下卡片」就自动进队；也可以拖到左侧指定槽位。
     左侧队伍区默认一列紧凑，点哪支队伍展开哪支。
  3. 共鸣模态：洛瑟菈 / 爱弥斯 / 达尼娅 / 琳奈 这四位，卡片上有双圆切换控件。
  4. 看全局：左下角点金色「一列点开」按钮可切「多列全景」，一次看所有队伍。
  5. 底部常驻「全队伍预览」；顶栏可切明暗主题、导出/分享配队链接。


【数据存在哪】

  存在浏览器本地（localStorage），不上传任何服务器。
  ⚠️ 换浏览器、清理浏览器数据、或者换一个文件夹重新打开 index.html，
     存档都可能丢失 —— 重要方案请用顶栏「导出 / 分享」备份。


【关于「源码」文件夹】

  里面是完整工程，给继续开发用的，需要先装 Node.js（https://nodejs.org/）。
  双击 源码/启动模拟器.bat 即可自动装依赖、构建、起服务并打开浏览器。
  详见 源码/README.md。
`

function main() {
  log(`版本 ${VERSION}`)

  // 1) 构建免安装版
  log('构建免安装版（IIFE / 可在 file:// 下运行）…')
  // 直接调本地 vite 的入口，绕开 Windows 上 npx.cmd 的 spawn EINVAL 问题
  execFileSync(
    process.execPath,
    [join('node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.config.offline.js'],
    { cwd: ROOT, stdio: 'inherit' },
  )

  // 2) 清空并重建暂存目录
  if (existsSync(STAGE)) rmSync(STAGE, { recursive: true, force: true })
  mkdirSync(DIST, { recursive: true })

  // 3) 免安装版放到包根目录（双击 index.html 即可）
  log('拷贝免安装版到包根目录…')
  cpSync(join(ROOT, 'dist-offline'), DIST, { recursive: true })

  // 4) 源码
  log('拷贝源码…')
  const srcDir = join(DIST, '源码')
  mkdirSync(srcDir, { recursive: true })
  const missing = []
  for (const item of SOURCE_ITEMS) {
    const from = join(ROOT, item)
    if (!existsSync(from)) {
      missing.push(item)
      continue
    }
    cpSync(from, join(srcDir, item), { recursive: true })
  }
  if (missing.length) log(`⚠ 源码里缺少：${missing.join('、')}`)

  // 5) 使用说明
  writeFileSync(join(DIST, '使用说明.txt'), USAGE, 'utf8')

  // 6) 压缩
  log('压缩中…')
  if (existsSync(OUT_ZIP)) rmSync(OUT_ZIP, { force: true })
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -LiteralPath '${DIST}' -DestinationPath '${OUT_ZIP}' -CompressionLevel Optimal`,
    ],
    { stdio: 'inherit' },
  )

  // 7) 报告
  const zipMB = (statSync(OUT_ZIP).size / 1024 / 1024).toFixed(1)
  const srcMB = (
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `(Get-ChildItem -LiteralPath '${DIST}' -Recurse -File | Measure-Object Length -Sum).Sum`,
    ])
      .toString()
      .trim() / 1024 / 1024
  ).toFixed(1)
  log(`完成：${OUT_ZIP}`)
  log(`解压后 ${srcMB} MB，压缩包 ${zipMB} MB`)
}

main()
