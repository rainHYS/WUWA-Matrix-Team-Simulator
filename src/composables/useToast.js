/** 轻量全局提示（Toast） */
import { reactive } from 'vue'

export const toasts = reactive([])

let seq = 0

export function pushToast({ type = 'info', text = '', duration = 2400 }) {
  if (!text) return
  const id = ++seq
  toasts.push({ id, type, text })
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  if (toasts.length > 4) toasts.shift()
  return id
}

export function dismissToast(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}
