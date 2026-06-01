import type { ReactNode } from "react"

interface AuthPageShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <main className="min-h-screen bg-base text-copy-primary">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 px-6 py-10 md:grid-cols-2 md:gap-8 md:px-10">
        <section className="hidden md:flex md:flex-col md:justify-center">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Ghost AI</p>
            <h1 className="mt-4 text-3xl font-semibold text-copy-primary">{title}</h1>
            <p className="mt-3 text-sm text-copy-secondary">{subtitle}</p>
            <ul className="mt-8 space-y-3 text-sm text-copy-muted">
              <li>Collaborative architecture canvas in real time.</li>
              <li>AI-assisted system design from natural language prompts.</li>
              <li>Persistent project workspaces and generated specifications.</li>
            </ul>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-surface-border bg-surface p-6 md:p-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
