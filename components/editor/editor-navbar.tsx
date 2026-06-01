"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
}: EditorNavbarProps) {
  const SidebarIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen;

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
        <div className="flex flex-1 items-center justify-center" />
        <div className="flex flex-1 items-center justify-end">
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
