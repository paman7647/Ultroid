'use client';

import { Bot } from 'lucide-react';

/**
 * Renders a small "BOT" badge next to a user's name to indicate a bot account.
 */
export function BotBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-400 ${className ?? ''}`}
    >
      <Bot className="h-3 w-3" />
      Bot
    </span>
  );
}

/**
 * Bot avatar with a distinctive gradient border.
 */
export function BotAvatar({
  username,
  avatarUrl,
  size = 'md',
}: {
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeMap = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-16 w-16' };
  const textSize = { sm: 'text-xs', md: 'text-sm', lg: 'text-xl' };

  return (
    <div className={`relative rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 ${sizeMap[size]}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${username} avatar`}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center rounded-full bg-gray-800 ${textSize[size]} font-bold text-white`}>
          <Bot className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
}
