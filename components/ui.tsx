'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { CostumeStatus, Location, StaffStatus } from '@/lib/types'
import { COSTUME_META, STATUS_META, cn } from '@/lib/utils'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col items-center gap-3 text-center sm:mb-6 md:flex-row md:items-end md:justify-between md:text-left">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-bone-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">{actions}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: StaffStatus }) {
  const m = STATUS_META[status]
  return <span className={cn('chip', m.cls)}>{m.label}</span>
}

export function CostumeBadge({ status }: { status: CostumeStatus }) {
  const m = COSTUME_META[status]
  return (
    <span className={cn('chip', m.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  )
}

export function ColorChip({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('chip', className)}
      style={{ color, backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {children}
    </span>
  )
}

export function LocationChip({ location }: { location?: Location }) {
  if (!location) return null
  return <ColorChip color={location.color}>{location.name}</ColorChip>
}

export function Avatar({ name, color = '#ff5a1f', size = 36 }: { name: string; color?: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const init = `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold tracking-wide"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color,
        background: `radial-gradient(circle at 30% 25%, ${color}38, ${color}12)`,
        boxShadow: `inset 0 0 0 1px ${color}55`,
      }}
    >
      {init}
    </span>
  )
}

export function Stat({ label, value, hint, accent, icon }: { label: string; value: ReactNode; hint?: ReactNode; accent?: string; icon?: ReactNode }) {
  return (
    <div className="card card-pad relative overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-bone-muted">{label}</span>
        {icon && <span className="text-bone-dim">{icon}</span>}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-bone-muted">{hint}</div>}
    </div>
  )
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-bone-dim">{icon}</div>}
      <p className="font-display text-lg uppercase tracking-wide text-bone">{title}</p>
      {children && <p className="max-w-sm text-sm text-bone-muted">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'animate-in flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-white/10 bg-ink-900 shadow-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
          <h2 className="font-display text-lg uppercase tracking-wide">{title}</h2>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.07] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-bone-dim">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; color?: string }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-xl bg-ink-950/70 p-1 ring-1 ring-white/10', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === o.value ? 'bg-ink-700 text-bone shadow' : 'text-bone-muted hover:text-bone',
          )}
          style={value === o.value && o.color ? { color: o.color, boxShadow: `inset 0 0 0 1px ${o.color}55` } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, max, color = '#ff5a1f' }: { value: number; max: number; color?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-blood" />
    </div>
  )
}
