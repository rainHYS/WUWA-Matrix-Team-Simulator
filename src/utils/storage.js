/**
 * localStorage 持久化（单机）
 * 纯前端方案：所有状态存浏览器本地，无服务器。
 */
const STORAGE_KEY = 'wuwa-matrix:v1'

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : null
  } catch (err) {
    console.warn('[storage] 读取本地存档失败，将以默认配置启动', err)
    return null
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch (err) {
    console.warn('[storage] 写入本地存档失败', err)
    return false
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[storage] 清除本地存档失败', err)
  }
}

export { STORAGE_KEY }
