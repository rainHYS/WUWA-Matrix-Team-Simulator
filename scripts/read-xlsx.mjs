/**
 * 读取 xlsx（本质是 zip）—— 开发辅助脚本
 * 解压后直接解析 xl/sharedStrings.xml 与 xl/worksheets/sheetN.xml，无需第三方库。
 * 用法：node scripts/read-xlsx.mjs <xlsx路径> [sheet序号=1]
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const file = resolve(process.argv[2] || '角色属性对照表.xlsx')
const sheetNo = Number(process.argv[3]) || 1
const tmp = mkdtempSync(join(tmpdir(), 'xlsx-'))

try {
  const zip = join(tmp, 'book.zip')
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Copy-Item -LiteralPath '${file.replace(/'/g, "''")}' -Destination '${zip}' -Force; Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force`,
  ])

  const unescape = (s) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')

  const ssXml = readFileSync(join(tmp, 'xl', 'sharedStrings.xml'), 'utf8')
  const shared = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unescape(
      [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''),
    ),
  )

  const shXml = readFileSync(join(tmp, 'xl', 'worksheets', `sheet${sheetNo}.xml`), 'utf8')
  const rows = [...shXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
  console.log(`工作表 sheet${sheetNo}：${rows.length} 行，共享字符串 ${shared.length} 条\n`)
  for (const r of rows) {
    const cells = [...r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
      const isStr = /t="s"/.test(c[2])
      const v = (c[3] || '').match(/<v>([\s\S]*?)<\/v>/)
      if (!v) return ''
      return isStr ? shared[Number(v[1])] ?? '' : v[1]
    })
    console.log(`${String(r[1]).padStart(2)} | ${cells.join(' | ')}`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
