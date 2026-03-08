'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Users, MessageCircle } from 'lucide-react';

type UserResult = { id: string; username: string; displayName: string };

interface NewConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateRoom: (type: 'DM' | 'GROUP', memberIds: string[], name?: string) => Promise<unknown>;
  searchUsers: (query: string) => Promise<UserResult[]>;
}

export function NewConversationDialog({
  open,
  onClose,
  onCreateRoom,
  searchUsers,
}: NewConversationDialogProps) {
  const [tab, setTab] = useState<'dm' | 'group'>('dm');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelected([]);
      setGroupName('');
      setTab('dm');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const users = await searchUsers(q);
        setResults(users.filter((u) => !selected.some((s) => s.id === u.id)));
        setLoading(false);
      }, 300);
    },
    [searchUsers, selected],
  );

  const handleSelectUser = useCallback(
    async (user: UserResult) => {
      if (tab === 'dm') {
        setCreating(true);
        await onCreateRoom('DM', [user.id]);
        setCreating(false);
        onClose();
      } else {
        setSelected((prev) => [...prev, user]);
        setResults((prev) => prev.filter((u) => u.id !== user.id));
        setQuery('');
      }
    },
    [tab, onCreateRoom, onClose],
  );

  const handleRemoveSelected = useCallback((userId: string) => {
    setSelected((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (selected.length < 1) return;
    setCreating(true);
    await onCreateRoom('GROUP', selected.map((u) => u.id), groupName || undefined);
    setCreating(false);
    onClose();
  }, [selected, groupName, onCreateRoom, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-background shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">New Conversation</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => { setTab('dm'); setSelected([]); }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'dm'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="mr-1.5 inline h-4 w-4" />
            Direct Message
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'group'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="mr-1.5 inline h-4 w-4" />
            Group
          </button>
        </div>

        {/* Group name input */}
        {tab === 'group' && (
          <div className="border-b border-border px-4 py-2">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              className="w-full rounded-md bg-muted px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}

        {/* Selected chips for group */}
        {tab === 'group' && selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {u.displayName}
                <button onClick={() => handleRemoveSelected(u.id)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-60 overflow-y-auto px-2 pb-2">
          {loading && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No users found</p>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              disabled={creating}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors disabled:opacity-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Create group button */}
        {tab === 'group' && (
          <div className="border-t border-border px-4 py-3">
            <button
              onClick={handleCreateGroup}
              disabled={selected.length < 1 || creating}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : `Create Group (${selected.length} member${selected.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
