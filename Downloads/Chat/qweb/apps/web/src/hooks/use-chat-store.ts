'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { useSocket } from '@/lib/socket-context';
import type { ChatMessage, ChatRoom, ContextPanelView, Me, TypingUser } from '@/lib/types';

const OFFLINE_KEY = 'qweb-offline-queue-v1';
type OfflineItem = { roomId: string; payload: Record<string, unknown> };

async function fileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useChatStore() {
  const [me, setMe] = useState<Me | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [contextPanel, setContextPanel] = useState<ContextPanelView>(null);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  const loadMe = useCallback(async () => {
    try {
      const data = await apiGet<Me>('/v1/auth/me');
      setMe(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const data = await apiGet<ChatRoom[]>('/v1/rooms');
      setRooms(data);
      return data;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (roomId: string, nextCursor?: string, append = false) => {
      setLoadingMessages(true);
      try {
        const path = nextCursor
          ? `/v1/rooms/${roomId}/messages?cursor=${encodeURIComponent(nextCursor)}`
          : `/v1/rooms/${roomId}/messages`;
        const data = await apiGet<ChatMessage[]>(path);
        const sorted = [...data].reverse();
        setMessages((prev) => (append ? [...sorted, ...prev] : sorted));
        const last = data.at(data.length - 1);
        setCursor(last ? last.id : null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  const selectRoom = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      setMessages([]);
      setCursor(null);
      setTypingUsers([]);
      setThreadMessageId(null);
    },
    [],
  );

  const sendMessage = useCallback(
    async (body: string, attachmentIds: string[] = [], replyToId?: string) => {
      if (!activeRoomId) return;
      if (!body.trim() && !attachmentIds.length) return;

      const payload: Record<string, unknown> = {
        body: body.trim() || undefined,
        kind: attachmentIds.length ? 'FILE' : 'TEXT',
        replyToId: replyToId ?? undefined,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      };

      if (!navigator.onLine) {
        const current = localStorage.getItem(OFFLINE_KEY);
        const queue = current ? (JSON.parse(current) as OfflineItem[]) : [];
        queue.push({ roomId: activeRoomId, payload });
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
        return;
      }

      try {
        await apiPost(`/v1/rooms/${activeRoomId}/messages`, payload);
      } catch (e) {
        setError((e as Error).message);
        const current = localStorage.getItem(OFFLINE_KEY);
        const queue = current ? (JSON.parse(current) as OfflineItem[]) : [];
        queue.push({ roomId: activeRoomId, payload });
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
      }
    },
    [activeRoomId],
  );

  const editMessage = useCallback(
    async (messageId: string, body: string) => {
      if (!activeRoomId || !body.trim()) return;
      await apiPatch(`/v1/rooms/${activeRoomId}/messages/${messageId}`, { body: body.trim() });
    },
    [activeRoomId],
  );

  const deleteMessage = useCallback(
    async (messageId: string, forEveryone: boolean) => {
      if (!activeRoomId) return;
      if (forEveryone) {
        await apiDelete(`/v1/rooms/${activeRoomId}/messages/${messageId}/everyone`);
      } else {
        await apiDelete(`/v1/rooms/${activeRoomId}/messages/${messageId}/me`);
      }
    },
    [activeRoomId],
  );

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeRoomId) return;
      await apiPost(`/v1/rooms/${activeRoomId}/messages/${messageId}/reactions`, { emoji });
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = [...(m.reactions ?? [])];
          const idx = reactions.findIndex((r) => r.emoji === emoji);
          if (idx >= 0) {
            const existing = reactions[idx]!;
            if (existing.reacted) {
              reactions[idx] = { ...existing, count: existing.count - 1, reacted: false };
              if (reactions[idx]!.count <= 0) reactions.splice(idx, 1);
            } else {
              reactions[idx] = { ...existing, count: existing.count + 1, reacted: true };
            }
          } else {
            reactions.push({ emoji, count: 1, reacted: true });
          }
          return { ...m, reactions };
        }),
      );
    },
    [activeRoomId],
  );

  const starMessage = useCallback(
    async (messageId: string, starred: boolean) => {
      if (!activeRoomId) return;
      if (starred) {
        await apiDelete(`/v1/rooms/${activeRoomId}/messages/${messageId}/star`);
      } else {
        await apiPost(`/v1/rooms/${activeRoomId}/messages/${messageId}/star`, {});
      }
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, starred: !starred } : m)));
    },
    [activeRoomId],
  );

  const pinRoom = useCallback(
    async (value: boolean) => {
      if (!activeRoomId) return;
      await apiPost(`/v1/rooms/${activeRoomId}/pin`, { value });
      await loadRooms();
    },
    [activeRoomId, loadRooms],
  );

  const archiveRoom = useCallback(
    async (value: boolean) => {
      if (!activeRoomId) return;
      await apiPost(`/v1/rooms/${activeRoomId}/archive`, { value });
      await loadRooms();
    },
    [activeRoomId, loadRooms],
  );

  const uploadFile = useCallback(async (file: File) => {
    const sha256 = await fileSha256(file);
    const sign = await apiPost<{ attachmentId: string; objectKey: string; signedUrl: string }>(
      '/v1/uploads/sign',
      { mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, sha256 },
    );
    const put = await fetch(sign.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!put.ok) throw new Error('Upload failed');
    await apiPost('/v1/uploads/complete', { attachmentId: sign.attachmentId, objectKey: sign.objectKey });
    return sign.attachmentId;
  }, []);

  const flushOffline = useCallback(async () => {
    const current = localStorage.getItem(OFFLINE_KEY);
    if (!current) return;
    const queue = JSON.parse(current) as OfflineItem[];
    const remaining: OfflineItem[] = [];
    for (const item of queue) {
      try {
        await apiPost(`/v1/rooms/${item.roomId}/messages`, item.payload);
      } catch {
        remaining.push(item);
      }
    }
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  }, []);

  // Socket.IO integration
  const { chatSocket, connected } = useSocket();

  useEffect(() => {
    if (!activeRoomId || !chatSocket) return;

    chatSocket.emit('room:join', { roomId: activeRoomId });

    const onNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      // Update unread count for other rooms
      setRooms((prev) =>
        prev.map((r) =>
          r.id === msg.senderId ? r : r, // Keep same, real update comes from re-fetch
        ),
      );
    };

    const onEditedMessage = (data: { messageId: string; body: string; editedAt: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, body: data.body, editedAt: data.editedAt } : m)),
      );
    };

    const onDeletedMessage = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };

    const onTypingUpdate = (data: { roomId: string; userId: string; displayName?: string; typing: boolean }) => {
      if (data.roomId !== activeRoomId) return;
      if (data.userId === me?.id) return;

      if (data.typing) {
        setTypingUsers((prev) => {
          if (prev.some((t) => t.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, displayName: data.displayName ?? 'Someone' }];
        });
        // Auto-clear after 5 seconds
        const existing = typingTimeouts.current.get(data.userId);
        if (existing) clearTimeout(existing);
        typingTimeouts.current.set(
          data.userId,
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((t) => t.userId !== data.userId));
            typingTimeouts.current.delete(data.userId);
          }, 5000),
        );
      } else {
        setTypingUsers((prev) => prev.filter((t) => t.userId !== data.userId));
        const existing = typingTimeouts.current.get(data.userId);
        if (existing) {
          clearTimeout(existing);
          typingTimeouts.current.delete(data.userId);
        }
      }
    };

    chatSocket.on('message:new', onNewMessage);
    chatSocket.on('message:edited', onEditedMessage);
    chatSocket.on('message:deleted', onDeletedMessage);
    chatSocket.on('typing:update', onTypingUpdate);

    return () => {
      chatSocket.emit('room:leave', { roomId: activeRoomId });
      chatSocket.off('message:new', onNewMessage);
      chatSocket.off('message:edited', onEditedMessage);
      chatSocket.off('message:deleted', onDeletedMessage);
      chatSocket.off('typing:update', onTypingUpdate);
    };
  }, [activeRoomId, chatSocket, me?.id]);

  // Emit typing event
  const emitTyping = useCallback(
    (typing: boolean) => {
      if (!chatSocket || !activeRoomId) return;
      chatSocket.emit('typing:update', { roomId: activeRoomId, typing });
    },
    [chatSocket, activeRoomId],
  );

  // Load initial data
  useEffect(() => {
    void loadMe();
    void loadRooms().then((data) => {
      const first = data.at(0);
      if (first && !activeRoomId) selectRoom(first.id);
    });
  }, []);

  // Create a new room and select it
  const createRoom = useCallback(
    async (type: 'DM' | 'GROUP', memberIds: string[], name?: string) => {
      try {
        const room = await apiPost<ChatRoom>('/v1/rooms', { type, memberIds, name: name || undefined });
        setRooms((prev) => [room, ...prev]);
        selectRoom(room.id);
        return room;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [selectRoom],
  );

  // Search users for new conversation
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) return [];
    try {
      return await apiGet<Array<{ id: string; username: string; displayName: string }>>(`/v1/users/search?q=${encodeURIComponent(query)}`);
    } catch {
      return [];
    }
  }, []);

  // Load messages when room changes
  useEffect(() => {
    if (activeRoomId) void loadMessages(activeRoomId);
  }, [activeRoomId, loadMessages]);

  // Flush offline queue when coming online
  useEffect(() => {
    const handler = () => void flushOffline();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [flushOffline]);

  return {
    me,
    rooms,
    activeRoom,
    activeRoomId,
    messages,
    cursor,
    loadingMessages,
    loadingRooms,
    error,
    typingUsers,
    contextPanel,
    threadMessageId,
    searchOpen,
    sidebarOpen,
    connected,

    selectRoom,
    loadRooms,
    loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    starMessage,
    pinRoom,
    archiveRoom,
    uploadFile,
    emitTyping,
    createRoom,
    searchUsers,
    setError,
    setContextPanel,
    setThreadMessageId,
    setSearchOpen,
    setSidebarOpen,
  };
}
