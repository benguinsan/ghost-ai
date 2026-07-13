"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, FileText, Loader2 } from "lucide-react"

import { MarkdownPreview } from "@/components/editor/markdown-preview"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  getProjectSpecContent,
  getProjectSpecDownloadUrl,
  listProjectSpecs,
  type ProjectSpecSummary,
} from "@/lib/spec-api"

interface SpecsTabProps {
  projectId: string
  refreshKey?: number
}

function formatSpecDate(isoDate: string) {
  return new Date(isoDate).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function triggerSpecDownload(projectId: string, specId: string, filename: string) {
  const link = document.createElement("a")
  link.href = getProjectSpecDownloadUrl(projectId, specId)
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function SpecsTab({ projectId, refreshKey = 0 }: SpecsTabProps) {
  const [specs, setSpecs] = useState<ProjectSpecSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedSpec, setSelectedSpec] = useState<ProjectSpecSummary | null>(null)
  const [previewMarkdown, setPreviewMarkdown] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const loadSpecs = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await listProjectSpecs(projectId)

      if (result.status === "error") {
        if (result.kind === "forbidden") {
          setLoadError("You do not have access to specs for this project.")
        } else if (result.kind === "unavailable") {
          setLoadError("Could not load specs right now.")
        } else {
          setLoadError("Could not load specs right now.")
        }
        setSpecs([])
        return
      }

      setSpecs(result.specs)
    } catch (error) {
      console.error(error)
      setLoadError("Could not load specs right now.")
      setSpecs([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadSpecs()
  }, [loadSpecs, refreshKey])

  const handleOpenPreview = async (spec: ProjectSpecSummary) => {
    setSelectedSpec(spec)
    setPreviewMarkdown(null)
    setPreviewError(null)
    setIsPreviewLoading(true)

    try {
      const content = await getProjectSpecContent(projectId, spec.id)
      if (!content) {
        setPreviewError("Could not load this spec.")
        return
      }

      setPreviewMarkdown(content.markdown)
    } catch (error) {
      console.error(error)
      setPreviewError("Could not load this spec.")
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleClosePreview = (open: boolean) => {
    if (open) {
      return
    }

    setSelectedSpec(null)
    setPreviewMarkdown(null)
    setPreviewError(null)
    setIsPreviewLoading(false)
  }

  const handleDownload = (spec: ProjectSpecSummary) => {
    triggerSpecDownload(projectId, spec.id, spec.filename)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-surface-border bg-elevated">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-6 text-copy-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-copy-muted">{loadError}</p>
            <Button onClick={() => void loadSpecs()} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </div>
        ) : specs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="rounded-lg border border-surface-border bg-subtle p-2 text-ai-text">
              <FileText className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-copy-primary">No specs yet</p>
            <p className="text-xs text-copy-muted">Generated specs will appear here.</p>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <ul className="divide-y divide-surface-border p-2">
              {specs.map((spec) => (
                <li key={spec.id}>
                  <div className="flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-subtle">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void handleOpenPreview(spec)}
                      type="button"
                    >
                      <p className="truncate text-sm font-medium text-copy-primary">{spec.filename}</p>
                      <p className="mt-0.5 text-xs text-copy-muted">{formatSpecDate(spec.createdAt)}</p>
                    </button>
                    <Button
                      aria-label={`Download ${spec.filename}`}
                      onClick={() => handleDownload(spec)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>

      <Dialog onOpenChange={handleClosePreview} open={selectedSpec !== null}>
        <DialogContent className="flex max-h-[min(80vh,720px)] w-full max-w-2xl flex-col rounded-3xl border border-surface-border bg-elevated p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-surface-border px-4 py-3">
            <DialogTitle className="truncate text-copy-primary">
              {selectedSpec?.filename ?? "Spec preview"}
            </DialogTitle>
            <DialogDescription className="text-copy-muted">
              {selectedSpec ? formatSpecDate(selectedSpec.createdAt) : null}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1 px-4 py-3">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center py-12 text-copy-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : previewError ? (
              <p className="py-8 text-center text-sm text-copy-muted">{previewError}</p>
            ) : previewMarkdown ? (
              <MarkdownPreview content={previewMarkdown} />
            ) : null}
          </ScrollArea>

          <DialogFooter className="border-t border-surface-border bg-subtle/40 px-4 py-3">
            {selectedSpec ? (
              <Button
                className="border-surface-border"
                onClick={() => handleDownload(selectedSpec)}
                type="button"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
