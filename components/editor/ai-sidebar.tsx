"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Bot, Download, FileText, Send, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
] as const

export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const hasMessages = messages.length > 0

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = "72px"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [draft])

  useEffect(() => {
    const container = chatScrollRef.current
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages])

  const canSend = useMemo(() => draft.trim().length > 0, [draft])

  const handleSubmit = () => {
    const content = draft.trim()
    if (!content) {
      return
    }

    const now = Date.now()
    setMessages((previous) => [
      ...previous,
      { id: `user-${now}`, role: "user", content },
      {
        id: `assistant-${now}`,
        role: "assistant",
        content: "Ghost AI chat wiring comes in a later feature. This is the UI shell.",
      },
    ])
    setDraft("")
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <aside
      inert={!isOpen}
      className={cn(
        "pointer-events-none fixed top-14 right-0 bottom-0 z-40 hidden w-full max-w-sm p-4 transition-transform duration-200 ease-out md:block",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="pointer-events-auto flex h-full flex-col rounded-2xl border border-surface-border bg-base/95 shadow-lg backdrop-blur-sm">
        <header className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-0.5 rounded-md border border-surface-border bg-subtle p-1.5 text-ai-text">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-copy-primary">AI Workspace</h2>
              <p className="truncate text-xs text-copy-muted">Collaborate with Ghost AI</p>
            </div>
          </div>
          <Button aria-label="Close AI sidebar" onClick={onClose} size="icon-sm" type="button" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 p-4">
          <Tabs className="h-full" defaultValue="architect">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-subtle p-1">
              <TabsTrigger
                className="text-copy-muted data-active:bg-accent data-active:text-accent-foreground"
                value="architect"
              >
                AI Architect
              </TabsTrigger>
              <TabsTrigger
                className="text-copy-muted data-active:bg-accent data-active:text-accent-foreground"
                value="specs"
              >
                Specs
              </TabsTrigger>
            </TabsList>

            <TabsContent className="mt-3 h-[calc(100%-2.75rem)]" value="architect">
              <div className="flex h-full flex-col rounded-2xl border border-surface-border bg-elevated">
                <div className="min-h-0 flex-1 overflow-y-auto p-3" ref={chatScrollRef}>
                  {hasMessages ? (
                    <div className="space-y-2">
                      {messages.map((message) => (
                        <div
                          className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                          key={message.id}
                        >
                          <p
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                              message.role === "user"
                                ? "border-2 border-brand/50 bg-accent-dim text-copy-primary"
                                : "border border-surface-border bg-elevated text-ai-text"
                            )}
                          >
                            {message.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 px-3 text-center">
                      <div className="rounded-xl border border-surface-border bg-subtle p-2 text-ai-text">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-copy-primary">Start designing with Ghost AI</p>
                        <p className="text-xs text-copy-muted">
                          Pick a starter prompt to scaffold your architecture conversation.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {STARTER_PROMPTS.map((prompt) => (
                          <button
                            className="rounded-full border border-surface-border bg-subtle px-3 py-1.5 text-xs text-ai-text transition-colors hover:border-brand/60"
                            key={prompt}
                            onClick={() => setDraft(prompt)}
                            type="button"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-surface-border p-3">
                  <Textarea
                    className="max-h-40 min-h-[72px] resize-none border-surface-border bg-subtle text-copy-primary"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Ask Ghost AI to propose architecture updates..."
                    ref={textareaRef}
                    value={draft}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      className="bg-accent text-white hover:bg-accent/90"
                      disabled={!canSend}
                      onClick={handleSubmit}
                      type="button"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent className="mt-3 h-[calc(100%-2.75rem)]" value="specs">
              <div className="flex h-full flex-col gap-3">
                <Button className="w-full bg-accent text-white hover:bg-accent/90" type="button">
                  Generate Spec
                </Button>

                <div className="rounded-2xl border border-surface-border bg-elevated p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-surface-border bg-subtle p-2 text-ai-text">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-copy-primary">System Design Spec v0.1</p>
                      <p className="mt-1 text-xs text-copy-muted">
                        Generated draft summary for services, data flow, and deployment boundaries.
                      </p>
                    </div>
                  </div>

                  <Button
                    className="mt-4 w-full border-surface-border text-copy-muted"
                    disabled
                    type="button"
                    variant="outline"
                  >
                    <Download className="h-4 w-4" />
                    Download (Soon)
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </aside>
  )
}
