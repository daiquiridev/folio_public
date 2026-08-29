import type { ReactNode, ElementType } from 'react'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import { InfoIcon } from '@phosphor-icons/react'

interface SettingsCardProps {
  /** Section heading — rendered uppercase, semibold, so it reads as a title (never a field label). */
  title: string
  /** Optional leading icon next to the title. */
  icon?: ElementType
  /** Optional tooltip text shown via an info (i) icon next to the title. */
  info?: string
  /** Optional right-aligned control in the header (a button, switch, badge…). */
  action?: ReactNode
  children: ReactNode
  /** Override the body wrapper classes (defaults to a vertical gap-5 stack). */
  bodyClassName?: string
}

/**
 * The single section-card shell used by every options tab. One title style,
 * one border, one padding rhythm — so pages stop drifting apart visually.
 */
export function SettingsCard({ title, icon: Icon, info, action, children, bodyClassName }: SettingsCardProps) {
  return (
    <LayerCard className="riso-card">
      <div className="px-6 py-4 border-b border-kumo-line flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} className="text-kumo-subtle shrink-0" />}
          <h3 className="riso-card-title text-xs uppercase truncate">{title}</h3>
          {info && (
            <Tooltip content={info} side="right">
              <span className="flex items-center text-kumo-subtle hover:text-kumo-default cursor-default shrink-0">
                <InfoIcon size={13} />
              </span>
            </Tooltip>
          )}
        </div>
        {action}
      </div>
      <div className={bodyClassName ?? 'px-6 py-6 flex flex-col gap-5'}>{children}</div>
    </LayerCard>
  )
}

/** Vertical stack for CardRow items, with a built-in empty state. */
export function RowList({ children, empty }: { children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {empty != null ? empty : children}
    </div>
  )
}

/** A single list entry rendered as its own layered card instead of a table row. */
export function CardRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <LayerCard className={`px-4 py-3 flex items-center justify-between gap-3 text-sm ${className}`}>
      {children}
    </LayerCard>
  )
}
