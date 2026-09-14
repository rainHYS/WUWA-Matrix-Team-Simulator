import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

import './styles/theme.css'
import './styles/base.css'

// 首帧前先套用主题，避免明暗闪烁
try {
  const raw = localStorage.getItem('wuwa-matrix:v1')
  const theme = raw ? JSON.parse(raw)?.theme : null
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
} catch {
  document.documentElement.setAttribute('data-theme', 'dark')
}

createApp(App).use(createPinia()).mount('#app')
