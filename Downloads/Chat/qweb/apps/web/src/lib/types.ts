export type ChatRoom = {
  id: string;
  name: string | null;
  type: 'DM' | 'GROUP';
  memberships: Array<{ user: { id: string; username: string; displayName: string } }>;
  unreadCount: number;
  chatState?: { isArchived: boolean; isPinned: boolean };
};

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string | null;
  kind: string;
  createdAt: string;
  editedAt?: string | null;
  replyToId?: string | null;
  replyTo?: ChatMessage | null;
  sender: { id: string; username: string; displayName: string };
  reactions?: Array<{ emoji: string; count: number; reacted: boolean }>;
  starred?: boolean;
  pinned?: boolean;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    url: string;
    sizeBytes: number;
  }>;
};

export type Me = { id: string; username: string; displayName: string; email?: string };

export type TypingUser = { userId: string; displayName: string };

export type ContextPanelView = 'members' | 'threads' | 'pinned' | 'files' | 'profile' | null;
