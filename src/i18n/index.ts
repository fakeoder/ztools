import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import zh from './zh'

const STORAGE_KEY = 'ztools-language'

function getInitialLanguage(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh-CN') return saved
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
  }
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: en.common,
      landing: en.landing,
      legal: en.legal,
      tools: en.tools,
    },
    'zh-CN': {
      common: zh.common,
      landing: zh.landing,
      legal: zh.legal,
      tools: zh.tools,
    },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // ignore
  }
})

export default i18n