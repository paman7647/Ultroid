'use client';

import { X, Pin, Users, Paperclip, MessageSquare, FileText, Image, Film } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { ChatRoom, ContextPanelView } from '@/lib/types';

interface ContextPanelProps {
  view: ContextPanelView;
  room: ChatRoom | null;
  onClose: () => void;
  meId?: string;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ContextPanel({ view, room, onClose, meId }: ContextPanelProps) {
  if (!view || !room) return null;

  const title =
    view === 'members'
      ? 'Members'
      : view === 'pinned'
        ? 'Pinned Messages'
        : view === 'files'
          ? 'Shared Files'
          : view === 'threads'
            ? 'Threads'
            : 'Profile';

  const icon =
    view === 'members' ? (
      <Users className="h-4 w-4" />
    ) : view === 'pinned' ? (
      <Pin className="h-4 w-4" />
    ) : view === 'files' ? (
      <Paperclip className="h-4 w-4" />
    ) : (
      <MessageSquare className="h-4 w-4" />
    );

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-card/50 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {view === 'members' && <MembersView room={room} meId={meId} />}
        {view === 'pinned' && <PinnedView />}
        {view === 'files' && <FilesView />}
        {view === 'threads' && <ThreadsView />}
      </ScrollArea>
    </aside>
  );
}

function MembersView({ room, meId }: { room: ChatRoom; meId?: string }) {
  const onlineMembers = room.memberships;
  const offlineMembers: typeof room.memberships = [];

  return (
    <div className="p-3 space-y-4">
      {/* Online Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Members — {onlineMembers.length}
          </span>
        </div>
        <div className="space-y-0.5">
          {onlineMembers.map((m) => (
            <button
              key={m.user.id}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60 transition-colors"
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-accent/15 text-accent text-[10px]">
                    {initials(m.user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{m.user.displayName}</span>
                  {m.user.id === meId && (
                    <Badge variant="outline" className="text-[9px]">
                      you
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">@{m.user.username}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PinnedView() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Pin className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-medium">No pinned messages</p>
      <p className="text-xs text-muted-foreground">
        Pin important messages to find them here
      </p>
    </div>
  );
}

function FilesView() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Paperclip className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-medium">No shared files</p>
      <p className="text-xs text-muted-foreground">
        Files shared in this conversation will appear here
      </p>
    </div>
  );
}

function ThreadsView() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <MessageSquare className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-medium">No threads</p>
      <p className="text-xs text-muted-foreground">
        Reply to a message to start a thread
      </p>
    </div>
  );
}
