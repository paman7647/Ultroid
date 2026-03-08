'use client';

import { useState } from 'react';
import {
  CornerUpLeft,
  Copy,
  MoreHorizontal,
  Pencil,
  Pin,
  Star,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatMessage } from '@/lib/types';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '👏', '🎉'];

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  isGrouped: boolean; // Same sender as previous message
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onStar: (messageId: string, starred: boolean) => void;
  onThread: (messageId: string) => void;
  onPin?: (messageId: string) => void;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function MessageBubble({
  message,
  isMine,
  isGrouped,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onStar,
  onThread,
  onPin,
}: MessageBubbleProps) {
  const [hovering, setHovering] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(message.body ?? '');

  const handleEditSave = () => {
    onEdit({ ...message, body: editText });
    setEditMode(false);
  };

  const handleCopy = () => {
    if (message.body) navigator.clipboard.writeText(message.body);
  };

  return (
    <div
      className={`group relative flex gap-3 px-4 py-0.5 transition-colors hover:bg-muted/30 ${
        isGrouped ? 'mt-0' : 'mt-3'
      }`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Avatar or spacing */}
      <div className="w-9 shrink-0">
        {!isGrouped && (
          <Avatar className="h-9 w-9">
            <AvatarFallback
              className={`text-[11px] ${
                isMine
                  ? 'bg-primary/15 text-primary'
                  : 'bg-accent/15 text-accent'
              }`}
            >
              {initials(message.sender.displayName)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Message content */}
      <div className="min-w-0 flex-1">
        {/* Sender info (only for first in group) */}
        {!isGrouped && (
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-sm font-semibold">{message.sender.displayName}</span>
            <span className="text-[11px] text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
            {message.starred && <Star className="h-3 w-3 fill-warning text-warning" />}
            {message.pinned && <Pin className="h-3 w-3 text-primary" />}
          </div>
        )}

        {/* Reply context */}
        {message.replyTo && (
          <div className="mb-1 flex items-center gap-2 rounded-md border-l-2 border-primary/40 bg-muted/40 px-2 py-1">
            <span className="text-xs font-medium text-primary">
              {message.replyTo.sender.displayName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {message.replyTo.body}
            </span>
          </div>
        )}

        {/* Message body */}
        {editMode ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSave();
                }
                if (e.key === 'Escape') setEditMode(false);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
              rows={2}
              aria-label="Edit message"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Press <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> to save
              </span>
              <span>·</span>
              <button onClick={() => setEditMode(false)} className="text-primary hover:underline">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.body ?? (
              <span className="italic text-muted-foreground">[{message.kind}]</span>
            )}
            {message.editedAt && (
              <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>
            )}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs hover:bg-muted transition-colors"
              >
                <span className="truncate max-w-[200px]">{att.fileName}</span>
                <span className="text-muted-foreground">
                  {(att.sizeBytes / 1024).toFixed(0)}KB
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  r.reacted
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
            {/* Add reaction button */}
            <button
              onClick={() => onReact(message.id, '👍')}
              className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              +
            </button>
          </div>
        )}

        {/* Grouped timestamp on hover */}
        {isGrouped && hovering && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      {/* Action bar (visible on hover) */}
      {hovering && !editMode && (
        <div className="absolute -top-3 right-4 flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow-float animate-fade-in">
          {/* Quick reactions */}
          {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="rounded p-1 text-sm hover:bg-muted transition-colors"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <div className="mx-0.5 h-4 w-px bg-border" />

          <button
            onClick={() => onReply(message)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Reply"
          >
            <CornerUpLeft className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => onThread(message.id)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Thread"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onReply(message)}>
                <CornerUpLeft className="h-3.5 w-3.5" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onThread(message.id)}>
                <MessageSquare className="h-3.5 w-3.5" />
                Open Thread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
                Copy Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStar(message.id, !!message.starred)}>
                <Star className={`h-3.5 w-3.5 ${message.starred ? 'fill-current' : ''}`} />
                {message.starred ? 'Unstar' : 'Star'}
              </DropdownMenuItem>
              {onPin && (
                <DropdownMenuItem onClick={() => onPin(message.id)}>
                  <Pin className="h-3.5 w-3.5" />
                  Pin Message
                </DropdownMenuItem>
              )}
              {isMine && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setEditMode(true);
                      setEditText(message.body ?? '');
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    destructive
                    onClick={() => onDelete(message.id, true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete for Everyone
                  </DropdownMenuItem>
                </>
              )}
              {!isMine && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    destructive
                    onClick={() => onDelete(message.id, false)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete for Me
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
