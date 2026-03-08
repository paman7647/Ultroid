'use client';

import {
  Archive,
  Hash,
  MoreVertical,
  PanelRight,
  Phone,
  Pin,
  Search,
  Users,
  Video,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatRoom, ContextPanelView } from '@/lib/types';

interface ChatHeaderProps {
  room: ChatRoom | null;
  meId?: string;
  contextPanel: ContextPanelView;
  onTogglePanel: (view: ContextPanelView) => void;
  onSearchOpen: () => void;
  onPinRoom: (value: boolean) => void;
  onArchiveRoom: (value: boolean) => void;
}

function roomDisplayName(room: ChatRoom, meId?: string) {
  if (room.name) return room.name;
  if (room.type === 'DM') {
    const other = room.memberships.find((m) => m.user.id !== meId);
    return other?.user.displayName ?? 'Direct Message';
  }
  return room.memberships.map((m) => m.user.displayName).join(', ');
}

export function ChatHeader({
  room,
  meId,
  contextPanel,
  onTogglePanel,
  onSearchOpen,
  onPinRoom,
  onArchiveRoom,
}: ChatHeaderProps) {
  if (!room) {
    return (
      <header className="flex h-14 items-center border-b border-border bg-card/50 px-4">
        <span className="text-sm text-muted-foreground">Select a conversation</span>
      </header>
    );
  }

  const name = roomDisplayName(room, meId);
  const isPinned = room.chatState?.isPinned ?? false;
  const isArchived = room.chatState?.isArchived ?? false;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-14 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-4">
        {/* Left: Room info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            {room.type === 'GROUP' ? (
              <Hash className="h-4 w-4 text-muted-foreground" />
            ) : (
              <span className="text-sm font-semibold text-accent">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{name}</h1>
              {isPinned && <Pin className="h-3 w-3 text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {room.type === 'GROUP'
                ? `${room.memberships.length} members`
                : 'Direct message · encrypted'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSearchOpen}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Search in conversation"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Search</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Voice call"
              >
                <Phone className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Voice Call</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Video call"
              >
                <Video className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Video Call</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTogglePanel(contextPanel === 'pinned' ? null : 'pinned')}
                className={`rounded-md p-2 transition-colors ${
                  contextPanel === 'pinned'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label="Pinned messages"
              >
                <Pin className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Pinned Messages</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTogglePanel(contextPanel === 'members' ? null : 'members')}
                className={`rounded-md p-2 transition-colors ${
                  contextPanel === 'members'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label="Members"
              >
                <Users className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Members</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTogglePanel(contextPanel === 'files' ? null : 'files')}
                className={`rounded-md p-2 transition-colors ${
                  contextPanel === 'files'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label="Shared files"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Files</TooltipContent>
          </Tooltip>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPinRoom(!isPinned)}>
                <Pin className="h-3.5 w-3.5" />
                {isPinned ? 'Unpin' : 'Pin'} Conversation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchiveRoom(!isArchived)}>
                <Archive className="h-3.5 w-3.5" />
                {isArchived ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTogglePanel(contextPanel === 'threads' ? null : 'threads')}>
                <MessageSquare className="h-3.5 w-3.5" />
                Threads
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}
