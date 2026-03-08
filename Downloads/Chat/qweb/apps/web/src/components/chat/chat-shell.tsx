'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useChatStore } from '@/hooks/use-chat-store';
import { ConversationSidebar } from './conversation-sidebar';
import { ChatHeader } from './chat-header';
import { MessageTimeline } from './message-timeline';
import { MessageInput } from './message-input';
import { TypingIndicator } from './typing-indicator';
import { ContextPanel } from './context-panel';
import { SearchOverlay } from './search-overlay';
import { NewConversationDialog } from './new-conversation-dialog';
import type { ChatMessage } from '@/lib/types';

export function ChatShell() {
  const store = useChatStore();
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; body: string } | null>(null);
  const [newConvoOpen, setNewConvoOpen] = useState(false);

  const handleReply = useCallback(
    (msg: ChatMessage) => {
      setReplyTo({ id: msg.id, senderName: msg.sender.displayName, body: msg.body ?? '' });
    },
    [],
  );

  const handleEdit = useCallback(
    async (msg: ChatMessage) => {
      // Inline editing is handled inside MessageBubble; this is the save callback
    },
    [],
  );

  const handleSend = useCallback(
    async (body: string, attachmentIds: string[]) => {
      await store.sendMessage(body, attachmentIds, replyTo?.id);
      setReplyTo(null);
    },
    [store.sendMessage, replyTo],
  );

  const handleTogglePanel = useCallback(
    (view: import('@/lib/types').ContextPanelView) => {
      store.setContextPanel(store.contextPanel === view ? null : view);
    },
    [store.contextPanel, store.setContextPanel],
  );

  const roomName = store.activeRoom?.name
    ?? (store.activeRoom?.type === 'DM'
      ? store.activeRoom.memberships.find((m) => m.user.id !== store.me?.id)?.user.displayName ?? 'Direct Message'
      : 'Room');

  // Loading state
  if (store.loadingRooms && !store.rooms.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Layer 1: Conversation Sidebar */}
      {store.sidebarOpen && (
        <div className="w-72 shrink-0 border-r border-border">
          <ConversationSidebar
            rooms={store.rooms}
            activeRoomId={store.activeRoomId}
            onSelectRoom={store.selectRoom}
            onSearchOpen={() => store.setSearchOpen(true)}
            onNewConversation={() => setNewConvoOpen(true)}
            meId={store.me?.id}
            connected={store.connected}
          />
        </div>
      )}

      {/* Layer 2: Main Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          room={store.activeRoom}
          meId={store.me?.id}
          contextPanel={store.contextPanel}
          onTogglePanel={handleTogglePanel}
          onSearchOpen={() => store.setSearchOpen(true)}
          onPinRoom={store.pinRoom}
          onArchiveRoom={store.archiveRoom}
        />

        <div className="relative flex-1 overflow-hidden">
          <MessageTimeline
            messages={store.messages}
            meId={store.me?.id}
            loading={store.loadingMessages}
            cursor={store.cursor}
            onLoadOlder={() =>
              store.activeRoomId &&
              store.cursor &&
              store.loadMessages(store.activeRoomId, store.cursor, true)
            }
            onReply={handleReply}
            onEdit={handleEdit}
            onDelete={store.deleteMessage}
            onReact={store.reactToMessage}
            onStar={store.starMessage}
            onThread={(id) => store.setThreadMessageId(id)}
          />
        </div>

        <TypingIndicator users={store.typingUsers} />

        {store.error && (
          <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2">
            <p className="text-xs text-destructive">{store.error}</p>
          </div>
        )}

        <MessageInput
          roomName={roomName}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={handleSend}
          onUpload={store.uploadFile}
          onTyping={store.emitTyping}
          disabled={!store.activeRoomId}
        />
      </div>

      {/* Layer 3: Context Panel */}
      {store.contextPanel && (
        <div className="w-72 shrink-0">
          <ContextPanel
            view={store.contextPanel}
            room={store.activeRoom}
            onClose={() => store.setContextPanel(null)}
            meId={store.me?.id}
          />
        </div>
      )}

      {/* Search Overlay */}
      <SearchOverlay
        open={store.searchOpen}
        onClose={() => store.setSearchOpen(false)}
        activeRoomId={store.activeRoomId}
      />

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={newConvoOpen}
        onClose={() => setNewConvoOpen(false)}
        onCreateRoom={store.createRoom}
        searchUsers={store.searchUsers}
      />
    </div>
  );
}
