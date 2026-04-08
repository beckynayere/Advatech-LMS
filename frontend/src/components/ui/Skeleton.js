// DESTINATION: src/components/ui/Skeleton.js
'use client'

/**
 * Usage:
 *   <Skeleton />                          → single line, full width
 *   <Skeleton width="60%" height={12} />  → short line
 *   <Skeleton variant="card" />           → taller block, like a stat card
 *   <Skeleton variant="row" />            → table row height
 *   <Skeleton count={4} gap={12} />       → stacked lines
 */

const pulse = {
  background: 'linear-gradient(90deg, var(--gray-100) 25%, var(--gray-50) 50%, var(--gray-100) 75%)',
  backgroundSize: '400% 100%',
  animation: 'skeletonPulse 1.6s ease-in-out infinite',
  borderRadius: 6,
}

const VARIANTS = {
  line: { height: 14 },
  card: { height: 88, borderRadius: 12 },
  row:  { height: 52, borderRadius: 8 },
  stat: { height: 80, borderRadius: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%' },
}

export default function Skeleton({
  variant = 'line',
  width = '100%',
  height,
  count = 1,
  gap = 8,
  style = {},
}) {
  const base = { ...pulse, ...VARIANTS[variant], width, ...style }
  if (height) base.height = height

  if (count === 1) return (
    <>
      <style>{`@keyframes skeletonPulse{0%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
      <div style={base} />
    </>
  )

  return (
    <>
      <style>{`@keyframes skeletonPulse{0%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ ...base, width: i % 3 === 2 ? '70%' : width }} />
        ))}
      </div>
    </>
  )
}

// ─── Preset composites ─────────────────────────────────────────────────────────
export function SkeletonStatGrid({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="stat" />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
        <Skeleton width="40%" height={12} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: '14px 16px', borderBottom: i < rows - 1 ? '1px solid var(--border-light)' : 'none' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height={12} width={j === 0 ? '80%' : '60%'} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-light)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="35%" height={11} />
          <Skeleton width="75%" height={11} />
        </div>
      ))}
    </div>
  )
}