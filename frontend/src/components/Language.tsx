import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createLocale, DEFAULT_LANG, LANGS, LocaleContext, useLocale, type Lang } from '../lib/i18n'

const STORAGE_KEY = 'rp-tracker.lang'

/** The language chosen on an earlier visit, if the browser lets us read it. */
function storedLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return LANGS.some((lang) => lang.code === stored) ? (stored as Lang) : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(storedLang)
  const locale = useMemo(() => createLocale(lang, setLang), [lang])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = locale.t('app.title')
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  }, [lang, locale])

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

/** A two-way switch between Romanian and English. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useLocale()
  return (
    <div
      role="group"
      aria-label={t('language')}
      className="flex rounded-full border border-line bg-panel p-0.5 text-xs font-semibold shadow-sm"
    >
      {LANGS.map((option) => {
        const active = option.code === lang
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            title={option.name}
            aria-pressed={active}
            onClick={() => setLang(option.code)}
            className={`cursor-pointer rounded-full px-3 py-1 transition ${
              active ? 'bg-brand text-white dark:text-canvas' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
