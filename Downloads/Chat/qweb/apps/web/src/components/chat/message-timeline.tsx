'use client';

import { useEffect, useRef } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { useState, useCallback } from 'react';
import { MessageBubble } from './message-bubble';
import type { ChatMessage } from '@/lib/types';

interface MessageTimelineProps {
  messages: ChatMessage[];
  meId: string | undefined;
  loading: boolean;
  cursor: string | null;
  onLoadOlder: () => void;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onStar: (messageId: string, starred: boolean) => void;
  onThread: (messageId: string) => void;
}

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(dateStr, now.toISOString())) return 'Today';
  if (isSameDay(dateStr, yesterday.toISOString())) return 'Yesterday';

  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function MessageTimeline({
  messages,
  meId,
  loading,
  cursor,
  onLoadOlder,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onStar,
  onThread,
}: MessageTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const prevLengthRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      // New message added
      const container = containerRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      bottomRef.current?.scrollIntoView();
    }
  }, [loading && messages.length > 0]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollDown(distToBottom > 300);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Build messages with date dividers
  const elements: React.ReactNode[] = [];
  let lastDate = '';

  messages.forEach((msg, i) => {
    const msgDate = msg.createdAt;

    // Date divider
    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      elements.push(
        <div
          key={`date-${msgDate}`}
          className="flex items-center gap-3 px-4 py-3"
        >
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium text-muted-foreground">
            {formatDate(msgDate)}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>,
      );
      lastDate = msgDate;
    }

    // Is grouped with previous?
    const prev = messages[i - 1];
    const isGrouped =
      !!prev &&
      prev.senderId === msg.senderId &&
      isSameDay(prev.createdAt, msg.createdAt) &&
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;

    elements.push(
      <div key={msg.id} className="animate-message-in">
        <MessageBubble
          message={msg}
          isMine={msg.senderId === meId}
          isGrouped={isGrouped}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReact={onReact}
          onStar={onStar}
          onThread={onThread}
        />
      </div>,
    );

    lastDate = msgDate;
  });

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-y-auto scrollbar-thin"
      onScroll={handleScroll}
    >
      {/* Load older */}
      {cursor && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadOlder}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Load older messages'
            )}
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && messages.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading messages...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && messages.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground">
              Start the conversation by sending a message below
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="py-2">{elements}</div>

      {/* Scroll anchor */}
      <div ref={bottomRef} />

      {/* Scroll to bottom button */}
      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-float text-muted-foreground hover:text-foreground transition-all animate-fade-in"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
