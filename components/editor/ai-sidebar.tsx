"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import {
  useCreateFeed,
  useCreateFeedMessage,
  useFeedMessages,
  useSelf,
  useStorage,
  useUpdateMyPresence,
} from "@liveblocks/react"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react"

import { SpecsTab } from "@/components/editor/specs-tab"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { designAgentTask } from "@/trigger/design-agent"
import type { generateSpecTask } from "@/trigger/generate-spec"
import {
  AI_CHAT_FEED_ID,
  AI_STATUS_FEED_ID,
  parseAiChatMessage,
  parseAiStatusFeedMessage,
  type AiChatMessage,
} from "@/types/tasks"

interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

interface ChatEntry extends AiChatMessage {
  id: string
  createdAt: number
}

interface ActiveRun {
  runId: string
  token: string
}

type DesignRunOutput = {
  title?: string
  nodeCount?: number
  edgeCount?: number
}

type DesignRunResult =
  | { status: "completed"; output?: DesignRunOutput }
  | { status: "failed"; message?: string }

type SpecRunResult =
  | { status: "completed" }
  | { status: "failed"; message?: string }

const AI_SENDER = "Ghost AI"

const STARTER_PROMPTS = [
  "Design a payment service architecture",
  "Sketch an event-driven order pipeline",
  "Map a microservices auth flow",
] as const

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildCompletionMessage(output?: DesignRunOutput): string {
  const nodeCount = output?.nodeCount ?? 0
  const edgeCount = output?.edgeCount ?? 0
  const name = output?.title ? `“${output.title}”` : "your design"
  const nodes = `${nodeCount} component${nodeCount === 1 ? "" : "s"}`
  const edges = `${edgeCount} connection${edgeCount === 1 ? "" : "s"}`
  return `Done — I added ${name} to the canvas with ${nodes} and ${edges}.`
}

// Subscribes to the active design run and reports the terminal result once.
// Mounted only while a run is active so the hook auto-cleans up on completion.
function DesignRunTracker({
  runId,
  accessToken,
  onFinished,
}: {
  runId: string
  accessToken: string
  onFinished: (result: DesignRunResult) => void
}) {
  const finishedRef = useRef(false)

  const finish = useCallback(
    (result: DesignRunResult) => {
      if (finishedRef.current) {
        return
      }
      finishedRef.current = true
      onFinished(result)
    },
    [onFinished]
  )

  const { error } = useRealtimeRun<typeof designAgentTask>(runId, {
    accessToken,
    onComplete: (completedRun) => {
      if (completedRun.status === "COMPLETED") {
        finish({ status: "completed", output: completedRun.output })
      } else {
        finish({ status: "failed" })
      }
    },
  })

  useEffect(() => {
    if (error) {
      finish({ status: "failed", message: error.message })
    }
  }, [error, finish])

  return null
}

function SpecRunTracker({
  runId,
  accessToken,
  onFinished,
}: {
  runId: string
  accessToken: string
  onFinished: (result: SpecRunResult) => void
}) {
  const finishedRef = useRef(false)

  const finish = useCallback(
    (result: SpecRunResult) => {
      if (finishedRef.current) {
        return
      }
      finishedRef.current = true
      onFinished(result)
    },
    [onFinished]
  )

  const { error, run } = useRealtimeRun<typeof generateSpecTask>(runId, {
    accessToken,
    onComplete: (completedRun) => {
      if (completedRun.status === "COMPLETED") {
        finish({ status: "completed" })
      } else {
        finish({ status: "failed" })
      }
    },
  })

  useEffect(() => {
    if (error) {
      finish({ status: "failed", message: error.message })
    }
  }, [error, finish])

  const statusMessage =
    typeof run?.metadata?.message === "string" ? run.metadata.message.trim() : null

  if (!statusMessage) {
    return null
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-elevated px-3 py-2 text-xs font-medium text-brand">
      {statusMessage}
    </div>
  )
}

export function AiSidebar({ isOpen, onClose, projectId }: AiSidebarProps) {
  const [draft, setDraft] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const [activeSpecRun, setActiveSpecRun] = useState<ActiveRun | null>(null)
  const [isStartingSpec, setIsStartingSpec] = useState(false)
  const [specError, setSpecError] = useState<string | null>(null)
  const [specRefreshKey, setSpecRefreshKey] = useState(0)
  const [sendError, setSendError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const self = useSelf()
  const senderName = self?.info?.name?.trim() || "Anonymous"

  const updateMyPresence = useUpdateMyPresence()
  const createFeed = useCreateFeed()
  const createFeedMessage = useCreateFeedMessage()

  // Shared, room-wide "AI is generating" signal published by the design agent
  // into Liveblocks Storage — visible to every participant, not just the sender.
  const isGenerating = useStorage((root) => root.ai?.active ?? false) === true
  const statusFeed = useFeedMessages(AI_STATUS_FEED_ID)
  // Collaborative room chat feed — distinct from `ai-status-feed`.
  const chatFeed = useFeedMessages(AI_CHAT_FEED_ID)
  const { nodes: canvasNodes, edges: canvasEdges, isLoading: isCanvasFlowLoading } = useLiveblocksFlow()

  // A design run is active for this client (we started it) or for the room
  // (the shared Storage flag is set while the durable task runs).
  const isRunActive = activeRun !== null || isGenerating
  const isSpecRunActive = activeSpecRun !== null
  const isBusy = isSubmitting || isRunActive
  const isSpecBusy = isStartingSpec || isSpecRunActive

  // Most recent, validated status message from the shared `ai-status-feed`.
  const statusText = useMemo(() => {
    const feedMessages = "messages" in statusFeed ? statusFeed.messages : undefined
    if (!feedMessages || feedMessages.length === 0) {
      return null
    }

    const latest = feedMessages.reduce((newest, message) =>
      message.createdAt > newest.createdAt ? message : newest,
    )
    const parsed = parseAiStatusFeedMessage(latest.data)
    const text = parsed?.text?.trim()
    return text ? text : null
  }, [statusFeed])

  // Validated chat messages from `ai-chat`, rendered oldest-first.
  const chatMessages = useMemo<ChatEntry[]>(() => {
    const feedMessages = "messages" in chatFeed ? chatFeed.messages : undefined
    if (!feedMessages || feedMessages.length === 0) {
      return []
    }

    return feedMessages
      .map((message) => {
        const parsed = parseAiChatMessage(message.data)
        return parsed ? { ...parsed, id: message.id, createdAt: message.createdAt } : null
      })
      .filter((entry): entry is ChatEntry => entry !== null)
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [chatFeed])

  const hasMessages = chatMessages.length > 0

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
  }, [chatMessages])

  // Create the shared chat feed if it does not exist yet (reused otherwise).
  useEffect(() => {
    void Promise.resolve(createFeed(AI_CHAT_FEED_ID)).catch(() => {})
  }, [createFeed])

  // Reflect the shared generation state into this participant's presence so the
  // on-canvas cursor badge shows a thinking spinner while AI works.
  useEffect(() => {
    updateMyPresence({ thinking: isRunActive })
  }, [isRunActive, updateMyPresence])

  useEffect(() => {
    return () => {
      updateMyPresence({ thinking: false })
    }
  }, [updateMyPresence])

  const canSend = useMemo(() => draft.trim().length > 0 && !isBusy, [draft, isBusy])

  const postChatMessage = useCallback(
    (message: AiChatMessage) => {
      return Promise.resolve(createFeedMessage(AI_CHAT_FEED_ID, message))
    },
    [createFeedMessage]
  )

  const handleRunFinished = useCallback(
    (result: DesignRunResult) => {
      setActiveRun(null)

      const message: AiChatMessage =
        result.status === "completed"
          ? {
              sender: AI_SENDER,
              role: "assistant",
              content: buildCompletionMessage(result.output),
              timestamp: Date.now(),
            }
          : {
              sender: AI_SENDER,
              role: "assistant",
              content:
                result.message?.trim() ||
                "Ghost AI couldn't complete the design. Please try again.",
              timestamp: Date.now(),
            }

      void postChatMessage(message).catch((error) => {
        console.error("Failed to post AI completion message.", error)
      })
    },
    [postChatMessage]
  )

  const handleSpecRunFinished = useCallback((result: SpecRunResult) => {
    setActiveSpecRun(null)

    if (result.status === "completed") {
      setSpecError(null)
      setSpecRefreshKey((current) => current + 1)
      return
    }

    setSpecError(result.message?.trim() || "Ghost AI couldn't generate the spec. Please try again.")
  }, [])

  const handleGenerateSpec = async () => {
    if (isSpecBusy || isCanvasFlowLoading) {
      return
    }

    if (!canvasNodes || canvasNodes.length === 0) {
      setSpecError("Add components to the canvas before generating a spec.")
      return
    }

    setIsStartingSpec(true)
    setSpecError(null)

    const chatHistory = chatMessages.map((message) => ({
      sender: message.sender,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    }))

    try {
      const response = await fetch("/api/ai/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: projectId,
          chatHistory,
          nodes: canvasNodes,
          edges: canvasEdges ?? [],
        }),
      })

      if (!response.ok) {
        throw new Error(`Spec request failed with status ${response.status}.`)
      }

      const data = (await response.json()) as { runId?: string; publicToken?: string }
      if (!data.runId || !data.publicToken) {
        throw new Error("Spec request did not return a run token.")
      }

      setActiveSpecRun({ runId: data.runId, token: data.publicToken })
    } catch (error) {
      console.error("Failed to start spec generation.", error)
      setSpecError("Ghost AI couldn't start spec generation. Please try again.")
    } finally {
      setIsStartingSpec(false)
    }
  }

  const handleSubmit = async () => {
    const content = draft.trim()
    if (!content || isBusy) {
      return
    }

    setIsSubmitting(true)
    setSendError(null)

    const userMessage: AiChatMessage = {
      sender: senderName,
      role: "user",
      content,
      timestamp: Date.now(),
    }

    try {
      await postChatMessage(userMessage)
      setDraft("")

      const response = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content, roomId: projectId, projectId }),
      })

      if (!response.ok) {
        throw new Error(`Design request failed with status ${response.status}.`)
      }

      const data = (await response.json()) as { runId?: string; publicToken?: string }
      if (!data.runId || !data.publicToken) {
        throw new Error("Design request did not return a run token.")
      }

      setActiveRun({ runId: data.runId, token: data.publicToken })
    } catch (error) {
      console.error("Failed to start design generation.", error)

      // Surface errors in the chat feed per spec; fall back to an inline banner
      // if the feed post itself fails.
      void postChatMessage({
        sender: AI_SENDER,
        role: "assistant",
        content: "Ghost AI couldn't start the design. Please try again.",
        timestamp: Date.now(),
      }).catch(() => {
        setSendError("Something went wrong. Please try again.")
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
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
      {activeRun ? (
        <DesignRunTracker
          accessToken={activeRun.token}
          onFinished={handleRunFinished}
          runId={activeRun.runId}
        />
      ) : null}
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
                    <div className="space-y-3">
                      {chatMessages.map((message) => {
                        const isOwn = message.sender === senderName
                        const isAssistant = message.role === "assistant"
                        return (
                          <div
                            className={cn(
                              "flex flex-col gap-1",
                              isAssistant ? "items-start" : isOwn ? "items-end" : "items-start"
                            )}
                            key={message.id}
                          >
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-xs font-medium text-copy-secondary">
                                {message.sender}
                              </span>
                              <span className="text-[10px] text-copy-faint">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                                isAssistant
                                  ? "border border-surface-border bg-subtle text-copy-primary"
                                  : "bg-accent-green font-medium text-base"
                              )}
                            >
                              {message.content}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 px-3 text-center">
                      <div className="rounded-xl border border-surface-border bg-subtle p-2 text-ai-text">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-copy-primary">Design with Ghost AI</p>
                        <p className="text-xs text-copy-muted">
                          Describe a system and AI will draw it on the shared canvas.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {STARTER_PROMPTS.map((prompt) => (
                          <button
                            className="rounded-full border border-surface-border bg-subtle px-3 py-1.5 text-xs text-ai-text transition-colors hover:border-accent-green/60"
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
                  {isRunActive ? (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent-green/40 bg-elevated px-3 py-2 text-xs font-medium text-accent-green">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      <span className="truncate">{statusText ?? "Ghost AI is working…"}</span>
                    </div>
                  ) : null}
                  {sendError ? (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                      <span className="truncate">{sendError}</span>
                    </div>
                  ) : null}
                  <Textarea
                    className="max-h-40 min-h-[72px] resize-none border-surface-border bg-subtle text-copy-primary"
                    disabled={isBusy}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Describe the system you want to design..."
                    ref={textareaRef}
                    value={draft}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      className="bg-accent-green text-base hover:bg-accent-green/90"
                      disabled={!canSend}
                      onClick={() => void handleSubmit()}
                      type="button"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isBusy ? "Working..." : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent className="mt-3 h-[calc(100%-2.75rem)]" value="specs">
              <div className="flex h-full flex-col gap-3">
                {activeSpecRun ? (
                  <SpecRunTracker
                    accessToken={activeSpecRun.token}
                    onFinished={handleSpecRunFinished}
                    runId={activeSpecRun.runId}
                  />
                ) : null}
                {specError ? (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {specError}
                  </div>
                ) : null}
                <Button
                  className="w-full bg-accent text-white hover:bg-accent/90"
                  disabled={isSpecBusy || isCanvasFlowLoading}
                  onClick={() => void handleGenerateSpec()}
                  type="button"
                >
                  {isSpecBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSpecBusy ? "Generating..." : "Generate Spec"}
                </Button>
                <SpecsTab projectId={projectId} refreshKey={specRefreshKey} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </aside>
  )
}
