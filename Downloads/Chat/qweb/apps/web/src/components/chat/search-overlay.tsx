'use client';

import { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { ChatMessage } from '@/lib/types';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  activeRoomId: string | null;
}

export function SearchOverlay({ open, onClose, activeRoomId }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSearch = async () => {
    if (!query.trim() || !activeRoomId) return;
    setLoading(true);
    try {
      const data = await apiGet<ChatMessage[]>(
        `/v1/rooms/${activeRoomId}/search/messages?q=${encodeURIComponent(query.trim())}`,
      );
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Search panel */}
      <div className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-card shadow-float animate-slide-up">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4.5 w-4.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            placeholder="Search messages, files, users..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && results.length === 0 && !query && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Search across your conversations
              </p>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
                <span>Try searching for messages, @mentions, or file names</span>
              </div>
            </div>
          )}

          {results.map((msg) => (
            <button
              key={msg.id}
              onClick={onClose}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {msg.sender.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{msg.sender.displayName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {msg.body}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
