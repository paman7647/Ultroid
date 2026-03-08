'use client';

import { useState, useEffect, useCallback } from 'react';
import { Music, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceBotStream {
  botId: string;
  botName: string;
  status: 'BUFFERING' | 'PLAYING' | 'PAUSED' | 'STOPPED';
  volume: number;
  sourceUrl: string;
}

/**
 * Indicator shown in a voice channel when a bot is streaming audio.
 */
export function VoiceBotIndicator({ stream }: { stream: VoiceBotStream }) {
  const isPlaying = stream.status === 'PLAYING';
  const isPaused = stream.status === 'PAUSED';
  const isBuffering = stream.status === 'BUFFERING';

  return (
    <div className="flex items-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-2">
      <div className="relative">
        <Music className="h-4 w-4 text-indigo-400" />
        {isPlaying && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{stream.botName}</p>
        <p className="text-xs text-muted-foreground">
          {isBuffering && 'Buffering...'}
          {isPlaying && 'Playing'}
          {isPaused && 'Paused'}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {stream.volume > 0 ? (
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">{stream.volume}%</span>
      </div>
    </div>
  );
}

/**
 * Autocomplete dropdown for bot commands.
 * Shows matching commands as the user types / or ! prefix.
 */
export function CommandAutocomplete({
  suggestions,
  onSelect,
  visible,
}: {
  suggestions: Array<{ name: string; description: string; botUsername: string }>;
  onSelect: (command: string) => void;
  visible: boolean;
}) {
  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1 w-72 rounded-lg border bg-popover p-1 shadow-lg">
      {suggestions.map((cmd) => (
        <button
          key={`${cmd.botUsername}:${cmd.name}`}
          type="button"
          className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
          onClick={() => onSelect(`/${cmd.name} `)}
        >
          <span className="font-mono text-sm text-indigo-400">/{cmd.name}</span>
          <span className="flex-1 text-xs text-muted-foreground truncate">{cmd.description}</span>
          <span className="text-[10px] text-muted-foreground">@{cmd.botUsername}</span>
        </button>
      ))}
    </div>
  );
}
