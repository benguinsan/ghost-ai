"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Trash2, UserRoundPlus } from "lucide-react"

import { EditorDialogPattern } from "@/components/editor/dialog-pattern"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface ShareDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
}

interface Collaborator {
  email: string
  name: string | null
  avatarUrl: string | null
}

type AccessRole = "owner" | "collaborator"
type CopyState = "idle" | "copied"

function getCollaboratorLabel(collaborator: Collaborator) {
  return collaborator.name?.trim() || collaborator.email
}

function getCollaboratorInitial(collaborator: Collaborator) {
  return getCollaboratorLabel(collaborator).charAt(0).toUpperCase()
}

export function ShareDialog({ isOpen, onOpenChange, projectId, projectName }: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [role, setRole] = useState<AccessRole>("collaborator")
  const [inviteEmail, setInviteEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>("idle")
  const copyResetTimeoutRef = useRef<number | null>(null)

  const isOwner = role === "owner"

  const loadCollaborators = async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "GET",
      })

      if (!response.ok) {
        throw new Error("Failed to load collaborators.")
      }

      const payload = (await response.json()) as {
        role: AccessRole
        collaborators: Collaborator[]
      }

      setRole(payload.role)
      setCollaborators(payload.collaborators)
    } catch (error) {
      console.error(error)
      setErrorMessage("Could not load collaborator data right now.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    void loadCollaborators()
  }, [isOpen, projectId])

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const copyProjectLink = async () => {
    if (typeof window === "undefined") {
      return
    }

    const projectUrl = `${window.location.origin}/editor/${projectId}`

    try {
      await navigator.clipboard.writeText(projectUrl)
      setCopyState("copied")

      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyState("idle")
      }, 1500)
    } catch (error) {
      console.error(error)
    }
  }

  const inviteCollaborator = async () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase()
    if (!normalizedEmail || isInviting) {
      return
    }

    try {
      setIsInviting(true)
      setErrorMessage(null)

      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? "Failed to invite collaborator.")
      }

      setInviteEmail("")
      await loadCollaborators()
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : "Failed to invite collaborator.")
    } finally {
      setIsInviting(false)
    }
  }

  const removeCollaborator = async (email: string) => {
    if (removingEmail) {
      return
    }

    try {
      setRemovingEmail(email)
      setErrorMessage(null)

      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? "Failed to remove collaborator.")
      }

      await loadCollaborators()
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove collaborator.")
    } finally {
      setRemovingEmail(null)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <EditorDialogPattern
        description={`Manage project access for ${projectName}.`}
        footerActions={
          <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
            Close
          </Button>
        }
        title="Share Project"
      >
        <div className="space-y-4">
          {isOwner ? (
            <div className="space-y-2">
              <p className="text-xs text-copy-muted">Invite collaborators by email</p>
              <div className="flex items-center gap-2">
                <Input
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  type="email"
                  value={inviteEmail}
                />
                <Button disabled={!inviteEmail.trim() || isInviting} onClick={inviteCollaborator} type="button">
                  <UserRoundPlus className="h-4 w-4" />
                  Invite
                </Button>
              </div>
              <Button
                className="w-full sm:w-auto"
                onClick={copyProjectLink}
                type="button"
                variant={copyState === "copied" ? "secondary" : "outline"}
              >
                {copyState === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copyState === "copied" ? "Copied!" : "Copy project link"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-surface-border bg-subtle p-3 text-sm text-copy-muted">
              You have collaborator access. Only the project owner can manage sharing.
            </div>
          )}

          {errorMessage ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs text-copy-muted">Collaborators</p>
            {isLoading ? (
              <div className="rounded-xl border border-surface-border bg-subtle px-3 py-2 text-sm text-copy-muted">
                Loading collaborators...
              </div>
            ) : collaborators.length ? (
              <ul className="space-y-2">
                {collaborators.map((collaborator) => (
                  <li
                    className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-subtle px-3 py-2"
                    key={collaborator.email}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-surface-border bg-subtle bg-cover bg-center text-xs text-copy-secondary"
                        style={
                          collaborator.avatarUrl
                            ? {
                                backgroundImage: `url(${collaborator.avatarUrl})`,
                              }
                            : undefined
                        }
                      >
                        {collaborator.avatarUrl ? null : getCollaboratorInitial(collaborator)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-copy-primary">{getCollaboratorLabel(collaborator)}</p>
                        <p className="truncate text-xs text-copy-muted">{collaborator.email}</p>
                      </div>
                    </div>

                    {isOwner ? (
                      <Button
                        aria-label={`Remove ${collaborator.email}`}
                        disabled={Boolean(removingEmail)}
                        onClick={() => removeCollaborator(collaborator.email)}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-surface-border bg-subtle px-3 py-2 text-sm text-copy-muted">
                No collaborators yet.
              </div>
            )}
          </div>
        </div>
      </EditorDialogPattern>
    </Dialog>
  )
}
