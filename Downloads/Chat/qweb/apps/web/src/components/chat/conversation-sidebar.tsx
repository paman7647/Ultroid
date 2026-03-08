'use client';

import { useMemo, useState } from 'react';
import {
  Hash,
  Lock,
  MessageCircle,
  Pin,
  Plus,
  Search,
  Settings,
  Users,
  ChevronDown,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { ChatRoom } from '@/lib/types';

interface ConversationSidebarProps {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onSearchOpen: () => void;
  onNewConversation: () => void;
  meId?: string;
  connected: boolean;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function roomDisplayName(room: ChatRoom, meId?: string) {
  if (room.name) return room.name;
  if (room.type === 'DM') {
    const other = room.memberships.find((m) => m.user.id !== meId);
    return other?.user.displayName ?? 'Direct Message';
  }
  return room.memberships.map((m) => m.user.displayName).join(', ');
}

export function ConversationSidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onSearchOpen,
  onNewConversation,
  meId,
  connected,
}: ConversationSidebarProps) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<'all' | 'dms' | 'groups'>('all');

  const filtered = useMemo(() => {
    let list = rooms;
    if (section === 'dms') list = list.filter((r) => r.type === 'DM');
    if (section === 'groups') list = list.filter((r) => r.type === 'GROUP');
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((r) => roomDisplayName(r, meId).toLowerCase().includes(q));
    }
    // Pinned first, then by unread
    return [...list].sort((a, b) => {
      if (a.chatState?.isPinned && !b.chatState?.isPinned) return -1;
      if (!a.chatState?.isPinned && b.chatState?.isPinned) return 1;
      return (b.unreadCount ?? 0) - (a.unreadCount ?? 0);
    });
  }, [rooms, query, section, meId]);

  const pinnedRooms = filtered.filter((r) => r.chatState?.isPinned);
  const unpinnedRooms = filtered.filter((r) => !r.chatState?.isPinned);

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-heading text-sm font-bold">
            Q
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold">QWeb</h2>
            <div className="flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-destructive'}`}
              />
              <span className="text-[10px] text-muted-foreground">
                {connected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <button
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <button
          onClick={onSearchOpen}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search conversations...</span>
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pb-2">
        {(['all', 'dms', 'groups'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSection(tab)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              section === tab
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'dms' ? 'Direct' : 'Groups'}
          </button>
        ))}
      </div>

      <Separator />

      {/* Room list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* Pinned section */}
          {pinnedRooms.length > 0 && (
            <>
              <div className="flex items-center gap-1 px-2 py-1.5">
                <Pin className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pinned
                </span>
              </div>
              {pinnedRooms.map((room) => (
                <ConversationCard
                  key={room.id}
                  room={room}
                  active={room.id === activeRoomId}
                  onClick={() => onSelectRoom(room.id)}
                  meId={meId}
                />
              ))}
              <div className="py-1">
                <Separator />
              </div>
            </>
          )}

          {/* All conversations */}
          {section === 'all' && unpinnedRooms.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <MessageCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conversations
              </span>
            </div>
          )}

          {unpinnedRooms.map((room) => (
            <ConversationCard
              key={room.id}
              room={room}
              active={room.id === activeRoomId}
              onClick={() => onSelectRoom(room.id)}
              meId={meId}
            />
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No conversations found</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New conversation button */}
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={onNewConversation}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </button>
      </div>
    </aside>
  );
}

function ConversationCard({
  room,
  active,
  onClick,
  meId,
}: {
  room: ChatRoom;
  active: boolean;
  onClick: () => void;
  meId?: string;
}) {
  const name = roomDisplayName(room, meId);
  const hasUnread = (room.unreadCount ?? 0) > 0;

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-150 ${
        active
          ? 'bg-primary/10 text-foreground shadow-soft'
          : 'text-foreground/80 hover:bg-muted/60'
      }`}
    >
      <div className="relative">
        <Avatar className="h-9 w-9">
          <AvatarFallback
            className={`text-[11px] ${
              room.type === 'DM'
                ? 'bg-accent/15 text-accent'
                : 'bg-secondary/15 text-secondary'
            }`}
          >
            {room.type === 'DM' ? (
              initials(name)
            ) : (
              <Hash className="h-3.5 w-3.5" />
            )}
          </AvatarFallback>
        </Avatar>
        {/* Online indicator for DMs */}
        {room.type === 'DM' && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={`truncate text-sm ${hasUnread ? 'font-semibold' : 'font-medium'}`}>
            {name}
          </span>
          {room.chatState?.isPinned && (
            <Pin className="h-3 w-3 shrink-0 text-primary/60" />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {room.type === 'GROUP'
            ? `${room.memberships.length} members`
            : 'Direct message'}
        </p>
      </div>

      {hasUnread && (
        <Badge className="min-w-[20px] justify-center">
          {room.unreadCount > 99 ? '99+' : room.unreadCount}
        </Badge>
      )}
    </button>
  );
}
