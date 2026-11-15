import { lazy, Suspense } from 'react'
import { useHashPath } from './lib/hooks'
import { supabase } from './lib/supabase'
import { MemberPage, Members } from './pages/Members'
import { Overview } from './pages/Overview'

// The charting library is the bulk of the bundle; load it only for this page.
const Parties = lazy(() => import('./pages/Parties').then((page) => ({ default: page.Parties })))

const NAV = [
  { path: '/', label: 'Votes' },
  { path: '/parties', label: 'Parties' },
  { path: '/members', label: 'Members' },
]

function Page({ path }: { path: string }) {
  const member = /^\/members\/(\d+)$/.exec(path)
  if (member) return <MemberPage id={Number(member[1])} />
  if (path === '/members') return <Members />
  if (path === '/parties') return <Parties />
  if (path === '/') return <Overview />
  return <p className="notice">Page not found.</p>
}

export default function App() {
  const path = useHashPath()
  const section = path.startsWith('/members') ? '/members' : path

  return (
    <>
      <header className="site-header">
        <a className="site-title" href="#/">
          Romanian Parliament Vote Tracker
        </a>
        <nav aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.path}
              href={`#${item.path}`}
              aria-current={section === item.path ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {supabase ? (
          <Suspense fallback={<p className="notice">Loading…</p>}>
            <Page path={path} />
          </Suspense>
        ) : (
          <p className="notice notice-error" role="alert">
            This build has no data source. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and
            rebuild.
          </p>
        )}
      </main>
      <footer className="site-footer">
        Data from <a href="https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1">cdep.ro</a>,
        updated daily. Not an official publication.
      </footer>
    </>
  )
}
