import type { ReactNode } from "react"

import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface EditorDialogPatternProps {
  title: string
  description?: string
  children?: ReactNode
  footerActions?: ReactNode
}

export function EditorDialogPattern({
  title,
  description,
  children,
  footerActions,
}: EditorDialogPatternProps) {
  return (
    <DialogContent className="rounded-3xl border border-surface-border bg-elevated text-copy-primary shadow-xl ring-0 sm:max-w-md">
      <DialogHeader className="gap-1">
        <DialogTitle className="text-base text-copy-primary">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="text-copy-muted">
            {description}
          </DialogDescription>
        ) : null}
      </DialogHeader>
      {children}
      <DialogFooter className="rounded-b-3xl border-surface-border bg-subtle/60">
        {footerActions}
      </DialogFooter>
    </DialogContent>
  )
}
