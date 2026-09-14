/**
 * 修改 package.json 的版本号（避免用 PowerShell 文本管道把 UTF-8 文件写乱）
 * 用法：node scripts/set-version.mjs 0.6.0
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const file = resolve(join(__dirname, '..'), 'package.json')

const next = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(next || '')) {
  console.error('用法：node scripts/set-version.mjs <x.y.z>')
  process.exit(1)
}

const raw = readFileSync(file, 'utf8')
const updated = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`)
if (updated === raw) {
  console.error('没找到 version 字段，未修改')
  process.exit(1)
}
writeFileSync(file, updated, 'utf8')

const check = JSON.parse(readFileSync(file, 'utf8'))
console.log(`[set-version] ${check.version}  (${check.name})`)
