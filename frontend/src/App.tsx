import { lazy, Suspense, useState } from 'react'
import { Providers } from './components/Providers'
import { Sidebar } from './components/Sidebar'
import { Notice } from './components/ui'
import { useHashPath } from './lib/hooks'
import { useAppDataLoader } from './lib/store'
import { supabase } from './lib/supabase'
import { Dashboard } from './pages/Dashboard'
import { MemberPage, Members } from './pages/Members'
import { Votes } from './pages/Votes'

// The charting library is most of the bundle; load it only where it is used.
const PartyPage = lazy(() => import('./pages/PartyPage'))

function Page({ path }: { path: string }) {
  const party = /^\/parties\/(\d+)$/.exec(path)
  if (party) return <PartyPage id={Number(party[1])} />
  const member = /^\/members\/(\d+)$/.exec(path)
  if (member) return <MemberPage id={Number(member[1])} />
  if (path === '/members') return <Members />
  if (path === '/votes') return <Votes />
  if (path === '/') return <Dashboard />
  return <Notice>Page not found.</Notice>
}

/** Which sidebar entry a path belongs to. */
function sectionOf(path: string): string {
  if (path.startsWith('/members')) return '/members'
  if (path.startsWith('/votes')) return '/votes'
  return '/'
}

function Shell() {
  const path = useHashPath()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen lg:pl-72">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu and filters"
          className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm"
        >
          ☰
        </button>
        <span className="text-sm font-semibold">Parliament Vote Tracker</span>
      </header>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-sunken" />}>
          <Page path={path} />
        </Suspense>
      </main>
    </div>
  )
}

function Loaded() {
  const data = useAppDataLoader()
  if (data.status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-ink-2" role="status">
        Loading…
      </div>
    )
  }
  if (data.status === 'error') {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice error>Could not load data: {data.message}</Notice>
      </div>
    )
  }
  return (
    <Providers data={data.data}>
      <Shell />
    </Providers>
  )
}

export default function App() {
  if (!supabase) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice error>
          This build has no data source. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and
          rebuild.
        </Notice>
      </div>
    )
  }
  return <Loaded />
}
