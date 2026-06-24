import Link from "next/link"
import { Lock } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

export function AccessDenied() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-subtle">
          <Lock className="h-5 w-5 text-copy-secondary" />
        </div>
        <h1 className="text-xl font-semibold text-copy-primary">Access denied</h1>
        <p className="mt-2 text-sm text-copy-muted">
          This workspace is unavailable or you do not have permission to view it.
        </p>
        <Link className={`${buttonVariants({ variant: "secondary" })} mt-6`} href="/editor">
          Back to editor home
        </Link>
      </div>
    </div>
  )
}
