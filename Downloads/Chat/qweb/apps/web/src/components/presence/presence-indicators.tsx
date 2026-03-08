'use client';

import { Presence } from '@/hooks/use-realtime';

interface PresenceDotProps {
  presence: Presence | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

const colorMap: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-400',
};

/**
 * Colored dot indicator showing user's presence status.
 */
export function PresenceDot({ presence, size = 'md', className = '' }: PresenceDotProps) {
  const status = presence?.status ?? 'offline';

  return (
    <span
      className={`inline-block rounded-full ring-2 ring-white dark:ring-gray-900 ${sizeMap[size]} ${colorMap[status]} ${className}`}
      title={status}
    />
  );
}

interface PresenceBadgeProps {
  presence: Presence | undefined;
}

/**
 * Badge showing detailed presence info (typing, in call, in voice channel).
 */
export function PresenceBadge({ presence }: PresenceBadgeProps) {
  if (!presence) return null;

  if (presence.typing) {
    return (
      <span className="text-xs italic text-blue-500 dark:text-blue-400">typing...</span>
    );
  }

  if (presence.inCall) {
    return (
      <span className="text-xs text-green-600 dark:text-green-400">In a call</span>
    );
  }

  if (presence.inVoiceRoom) {
    return (
      <span className="text-xs text-purple-600 dark:text-purple-400">In voice channel</span>
    );
  }

  if (presence.status === 'offline' && presence.lastSeenAt) {
    const ago = timeSince(new Date(presence.lastSeenAt));
    return <span className="text-xs text-gray-400">Last seen {ago}</span>;
  }

  return null;
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
