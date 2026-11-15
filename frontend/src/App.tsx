import { lazy, Suspense, useState } from 'react'
import { LanguageProvider, LanguageSwitch } from './components/Language'
import { Providers } from './components/Providers'
import { Sidebar } from './components/Sidebar'
import { Notice } from './components/ui'
import { useHashPath } from './lib/hooks'
import { useLocale } from './lib/i18n'
import { useAppDataLoader } from './lib/store'
import { supabase } from './lib/supabase'
import { Dashboard } from './pages/Dashboard'
import { MemberPage, Members } from './pages/Members'
import { RegionPage, Regions } from './pages/Regions'
import { Votes } from './pages/Votes'

// The charting library is most of the bundle; load it only where it is used.
const PartyPage = lazy(() => import('./pages/PartyPage'))

function Page({ path }: { path: string }) {
  const { t } = useLocale()
  const party = /^\/parties\/(\d+)$/.exec(path)
  if (party) return <PartyPage id={Number(party[1])} />
  const member = /^\/members\/(\d+)$/.exec(path)
  if (member) return <MemberPage id={Number(member[1])} />
  const region = /^\/regions\/([a-z-]+)$/.exec(path)
  if (region) return <RegionPage slug={region[1]} />
  if (path === '/regions') return <Regions />
  if (path === '/members') return <Members />
  if (path === '/votes') return <Votes />
  if (path === '/') return <Dashboard />
  return <Notice>{t('error.notFound')}</Notice>
}

/** Which sidebar entry a path belongs to. */
function sectionOf(path: string): string {
  if (path.startsWith('/members')) return '/members'
  if (path.startsWith('/votes')) return '/votes'
  if (path.startsWith('/regions')) return '/regions'
  return '/'
}

function Shell() {
  const { t } = useLocale()
  const path = useHashPath()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen lg:pl-72">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t('menu.open')}
          className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm"
        >
          ☰
        </button>
        <span className="min-w-0 grow truncate text-sm font-semibold">{t('app.title')}</span>
        <LanguageSwitch />
      </header>

      {menuOpen && (
        <button
          type="button"
          aria-label={t('menu.close')}
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-line bg-panel transition-transform lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar section={sectionOf(path)} onNavigate={() => setMenuOpen(false)} />
      </aside>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* On wide screens the language switch sits in the top right corner. */}
        <div className="absolute right-8 top-8 hidden lg:block">
          <LanguageSwitch />
        </div>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-sunken" />}>
          <Page path={path} />
        </Suspense>
      </main>
    </div>
  )
}

function Loaded() {
  const { t } = useLocale()
  const data = useAppDataLoader()
  if (data.status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-ink-2" role="status">
        {t('loading')}
      </div>
    )
  }
  if (data.status === 'error') {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice error>{t('error.load', { message: data.message })}</Notice>
      </div>
    )
  }
  return (
    <Providers data={data.data}>
      <Shell />
    </Providers>
  )
}

function Root() {
  const { t } = useLocale()
  if (!supabase) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice error>{t('error.noSource')}</Notice>
      </div>
    )
  }
  return <Loaded />
}

export default function App() {
  return (
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  )
}
