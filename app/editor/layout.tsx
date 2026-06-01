import type { ReactNode } from "react"

import { EditorLayout } from "@/components/editor/editor-layout"

interface EditorRouteLayoutProps {
  children: ReactNode
}

export default function EditorRouteLayout({ children }: EditorRouteLayoutProps) {
  return <EditorLayout>{children}</EditorLayout>
}
