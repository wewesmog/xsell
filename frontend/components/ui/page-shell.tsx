import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function PageHeader({
  eyebrow = "X-Sell",
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <p className="text-brand-blue text-[11px] font-semibold tracking-[0.2em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-brand-blue text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  )
}

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6", className)}>{children}</div>
}

export function QuickLinkCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-lg transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <h2 className="text-brand-blue font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
    </Link>
  )
}

export function PageHeaderButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button className={cn("shadow-sm", className)} {...props} />
}
