'use client';

import type { TypingUser } from '@/lib/types';

interface TypingIndicatorProps {
  users: TypingUser[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const first = users[0]!;
  const text =
    users.length === 1
      ? `${first.displayName} is typing`
      : users.length === 2
        ? `${first.displayName} and ${users[1]!.displayName} are typing`
        : `${first.displayName} and ${users.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground animate-fade-in">
      <div className="flex gap-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-typing-dot" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-typing-dot [animation-delay:0.2s]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-typing-dot [animation-delay:0.4s]" />
      </div>
      <span>{text}</span>
    </div>
  );
}
