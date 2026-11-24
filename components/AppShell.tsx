'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shirt,
  Skull,
  SquareKanban,
  Timer,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { sortedLocations } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Loading } from './ui'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/checkin', label: 'Check-in', icon: ClipboardCheck },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/recruiting', label: 'Recruiting', icon: SquareKanban },
  { href: '/costumes', label: 'Costumes', icon: Shirt },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/timesheets', label: 'Timesheets', icon: Timer },
  { href: '/settings', label: 'Settings', icon: Settings },
]
const MOBILE_TABS = ['/', '/checkin', '/schedule', '/staff']

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'))

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blood/15 text-blood ring-1 ring-blood/40">
        <Skull size={20} />
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-semibold uppercase tracking-wider">FoS Productions</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-bone-dim">Cast &amp; crew app</span>
      </span>
    </Link>
  )
}

function LocationSwitcher({ compact }: { compact?: boolean }) {
  const { db, scope, setScope } = useStore()
  const opts = [{ id: 'all', name: compact ? 'All' : 'Both locations', color: '#ece9e2' }, ...sortedLocations(db)]
  return (
    <div className={cn('flex gap-1 rounded-xl bg-ink-950/80 p-1 ring-1 ring-white/10', compact ? '' : 'w-full')}>
      {opts.map((o) => {
        const on = scope === o.id
        return (
          <button
            key={o.id}
            onClick={() => setScope(o.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
              on ? 'bg-ink-700 text-bone' : 'text-bone-muted hover:text-bone',
            )}
            style={on && o.id !== 'all' ? { color: o.color, boxShadow: `inset 0 0 0 1px ${o.color}55` } : undefined}
            aria-pressed={on}
          >
            {o.id !== 'all' && <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} />}
            {o.name}
          </button>
        )
      })}
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname()
  const { db, inScope } = useStore()
  const newApplicants = db.staff.filter((s) => s.status === 'applied' && inScope(s)).length
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = isActive(path, href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              on ? 'bg-blood/[0.12] text-bone ring-1 ring-blood/30' : 'text-bone-muted hover:bg-white/[0.04] hover:text-bone',
            )}
          >
            <Icon size={18} className={on ? 'text-blood' : 'text-bone-dim group-hover:text-bone-muted'} />
            <span className="flex-1">{label}</span>
            {href === '/recruiting' && newApplicants > 0 && (
              <span className="rounded-full bg-blood px-1.5 py-0.5 text-[10px] font-bold text-white">{newApplicants}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function UserFooter() {
  const { mode, userLabel, signOut } = useStore()
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.06]">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', mode === 'live' ? 'live-dot bg-emerald-400' : 'bg-amber-400')} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{userLabel}</div>
        <div className="text-[10px] uppercase tracking-wider text-bone-dim">{mode === 'live' ? 'Live · synced' : 'Demo mode'}</div>
      </div>
      {mode === 'live' && (
        <button className="btn-ghost p-1.5" onClick={signOut} aria-label="Sign out" title="Sign out">
          <LogOut size={16} />
        </button>
      )}
    </div>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { ready, mode, session, error, reload } = useStore()
  const router = useRouter()
  const path = usePathname()
  const [drawer, setDrawer] = useState(false)

  useEffect(() => setDrawer(false), [path])
  useEffect(() => {
    if (ready && mode === 'live' && !session) router.replace('/login')
  }, [ready, mode, session, router])

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-5 border-r border-white/[0.06] bg-ink-950/90 p-4 backdrop-blur lg:flex">
        <Brand />
        <LocationSwitcher />
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <NavLinks />
        </div>
        <UserFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-white/[0.06] bg-ink-950/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blood/15 text-blood ring-1 ring-blood/40">
            <Skull size={17} />
          </span>
          <span className="font-display text-base font-semibold uppercase tracking-wider">FoS</span>
        </Link>
        <LocationSwitcher compact />
        <button className="btn-ghost p-2" onClick={() => setDrawer(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
          <div
            className="animate-in absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-4 border-l border-white/10 bg-ink-950 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button className="btn-ghost p-1.5" onClick={() => setDrawer(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setDrawer(false)} />
            </div>
            <UserFooter />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
        {mode === 'demo' && ready && (
          <div className="mb-5 flex flex-col items-center gap-1 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-center text-xs text-amber-200/90 sm:flex-row sm:justify-between sm:text-left">
            <span>
              <b className="font-semibold text-amber-200">Demo mode.</b> You&apos;re looking at sample data saved only in this browser.
            </span>
            <Link href="/settings#go-live" className="font-semibold text-amber-200 underline-offset-2 hover:underline">
              How to go live →
            </Link>
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button className="btn-secondary btn-sm" onClick={reload}>
              Retry
            </button>
          </div>
        )}
        {ready && (mode === 'demo' || session) ? children : <Loading />}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.06] bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => MOBILE_TABS.includes(n.href)).map(({ href, label, icon: Icon }) => {
          const on = isActive(path, href)
          return (
            <Link key={href} href={href} className={cn('flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', on ? 'text-blood' : 'text-bone-dim')}>
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-bone-dim">
          <Menu size={20} />
          More
        </button>
      </nav>
    </div>
  )
}
