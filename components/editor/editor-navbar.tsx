"use client";

import { AlertCircle, Bot, CheckCircle2, LayoutTemplate, Loader2, PanelLeftClose, PanelLeftOpen, Share2 } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import type { CanvasSaveStatus } from "@/components/editor/canvas-save-status-events";

interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  projectName?: string;
  onShare?: () => void;
  onOpenStarterTemplates?: () => void;
  isAiSidebarOpen?: boolean;
  onToggleAiSidebar?: () => void;
  saveStatus?: CanvasSaveStatus | null;
}

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
  projectName,
  onShare,
  onOpenStarterTemplates,
  isAiSidebarOpen = false,
  onToggleAiSidebar,
  saveStatus,
}: EditorNavbarProps) {
  const SidebarIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen;
  const showWorkspaceActions = Boolean(projectName);

  return (
    <header className="h-14 border-b border-surface-border bg-surface">
      <div className="flex h-full items-center gap-3 px-4">
        <div className="flex flex-1 items-center">
          <Button
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={onToggleSidebar}
            size="icon-sm"
            variant="ghost"
          >
            <SidebarIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          {projectName ? (
            <p className="truncate px-3 text-sm font-medium text-copy-primary">{projectName}</p>
          ) : null}
        </div>
        <div className="flex flex-1 items-center justify-end">
          {showWorkspaceActions ? (
            <div className="mr-2 flex items-center gap-2">
              <SaveStatusButton status={saveStatus ?? "saved"} />
              <Button onClick={onOpenStarterTemplates} type="button" variant="outline">
                <LayoutTemplate className="h-4 w-4" />
                Templates
              </Button>
              <Button onClick={onShare} type="button" variant="outline">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button onClick={onToggleAiSidebar} type="button" variant={isAiSidebarOpen ? "secondary" : "ghost"}>
                <Bot className="h-4 w-4" />
                AI
              </Button>
            </div>
          ) : null}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
                userButtonPopoverActionButton: "text-copy-primary hover:text-copy-primary",
                userButtonPopoverActionButtonIcon: "text-copy-secondary",
                userPreviewMainIdentifierText: "text-copy-primary",
                userPreviewSecondaryIdentifier: "text-copy-secondary",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}

interface SaveStatusButtonProps {
  status: CanvasSaveStatus;
}

function SaveStatusButton({ status }: SaveStatusButtonProps) {
  if (status === "saving") {
    return (
      <Button type="button" variant="outline">
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving
      </Button>
    );
  }

  if (status === "error") {
    return (
      <Button type="button" variant="outline">
        <AlertCircle className="h-4 w-4 text-state-error" />
        Save error
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline">
      <CheckCircle2 className="h-4 w-4 text-state-success" />
      Saved
    </Button>
  );
}
