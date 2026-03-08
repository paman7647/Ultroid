'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Loader2,
  Paperclip,
  SendHorizonal,
  Smile,
  X,
  Mic,
  AtSign,
  Bold,
  Italic,
  Code,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🎉', '🚀', '✨', '💯', '🙌', '😍', '🤔'];

interface MessageInputProps {
  roomName: string;
  replyTo: { id: string; senderName: string; body: string } | null;
  onCancelReply: () => void;
  onSend: (body: string, attachmentIds: string[]) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
  onTyping: (typing: boolean) => void;
  disabled?: boolean;
}

export function MessageInput({
  roomName,
  replyTo,
  onCancelReply,
  onSend,
  onUpload,
  onTyping,
  disabled,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  const handleTyping = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      onTyping(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingRef.current = false;
      onTyping(false);
    }, 2000);
  }, [onTyping]);

  const handleSend = async () => {
    if (sending || (!text.trim() && !attachmentIds.length)) return;
    setSending(true);
    try {
      await onSend(text, attachmentIds);
      setText('');
      setAttachmentIds([]);
      if (typingRef.current) {
        typingRef.current = false;
        onTyping(false);
      }
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      const ids: string[] = [];
      for (const file of Array.from(files)) {
        const id = await onUpload(file);
        ids.push(id);
      }
      setAttachmentIds((prev) => [...prev, ...ids]);
    } catch {
      // Error handled by parent
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const insertMarkdown = (wrapper: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + wrapper + selected + wrapper + text.slice(end);
    setText(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + wrapper.length, end + wrapper.length);
    }, 0);
  };

  return (
    <div
      className={`relative border-t border-border bg-card/80 backdrop-blur-sm transition-colors ${
        dragOver ? 'bg-primary/5 border-primary/30' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5">
          <div className="flex flex-col items-center gap-2">
            <Paperclip className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-primary">Drop files here</span>
          </div>
        </div>
      )}

      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 animate-slide-up">
          <div className="h-full w-0.5 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">
              Replying to {replyTo.senderName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{replyTo.body}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attachments preview */}
      {attachmentIds.length > 0 && (
        <div className="flex gap-2 border-b border-border px-4 py-2">
          {attachmentIds.map((id, i) => (
            <div
              key={id}
              className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
            >
              <Paperclip className="h-3 w-3" />
              <span>File {i + 1}</span>
              <button
                onClick={() => setAttachmentIds((prev) => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove file ${i + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-3 pt-2">
        <button
          onClick={() => insertMarkdown('**')}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => insertMarkdown('_')}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => insertMarkdown('`')}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main input area */}
      <div className="flex items-end gap-2 px-3 pb-3 pt-1">
        {/* Attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mb-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Attach file"
        >
          {uploading ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <Paperclip className="h-4.5 w-4.5" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Upload file"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />

        {/* Textarea */}
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
              // Auto-resize
              const ta = e.target;
              ta.style.height = 'auto';
              ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${roomName}...`}
            disabled={disabled}
            rows={1}
            className="w-full max-h-40 resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
            aria-label="Message input"
          />
        </div>

        {/* Emoji */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="mb-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Emoji picker"
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Quick reactions</div>
            <div className="grid grid-cols-6 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="rounded-md p-1.5 text-lg hover:bg-muted transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Send */}
        <button
          onClick={() => void handleSend()}
          disabled={sending || (!text.trim() && !attachmentIds.length)}
          className="mb-1 rounded-lg bg-primary p-2 text-primary-foreground shadow-soft hover:opacity-90 transition-all disabled:opacity-40 disabled:shadow-none"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <SendHorizonal className="h-4.5 w-4.5" />
          )}
        </button>
      </div>
    </div>
  );
}
