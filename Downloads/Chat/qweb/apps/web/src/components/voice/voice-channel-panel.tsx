'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Headphones, HeadphoneOff, LogOut, Users } from 'lucide-react';
import { useVoiceRoom } from '@/hooks/use-realtime';
import { useMediaStream, useWebRTC } from '@/hooks/use-webrtc';

function SpeakingIndicator({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div
      className={`h-3 w-3 rounded-full border-2 transition-colors ${
        isSpeaking ? 'border-green-400 bg-green-400 animate-pulse' : 'border-gray-500 bg-transparent'
      }`}
    />
  );
}

interface VoiceChannelPanelProps {
  voiceRooms: Array<{ id: string; name: string; memberCount: number }>;
}

export function VoiceChannelPanel({ voiceRooms }: VoiceChannelPanelProps) {
  const { currentRoom, joinRoom, leaveRoom, toggleMute, toggleDeafen } = useVoiceRoom();

  const {
    localStream,
    isMuted,
    startMedia,
    stopMedia,
    toggleMute: toggleLocalMute,
  } = useMediaStream();

  const { remoteStreams } = useWebRTC({
    callId: currentRoom?.id ?? null,
    localStream,
    namespace: 'voice',
  });

  // Audio elements for remote streams
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    for (const [userId, stream] of remoteStreams) {
      let audio = audioRefs.current.get(userId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioRefs.current.set(userId, audio);
      }
      audio.srcObject = stream;
    }
    // Cleanup departed users
    for (const [userId, audio] of audioRefs.current) {
      if (!remoteStreams.has(userId)) {
        audio.srcObject = null;
        audioRefs.current.delete(userId);
      }
    }
  }, [remoteStreams]);

  const handleJoin = async (roomId: string) => {
    await startMedia(false); // audio only
    joinRoom(roomId);
  };

  const handleLeave = () => {
    stopMedia();
    leaveRoom();
  };

  const handleToggleMute = () => {
    toggleLocalMute();
    toggleMute();
  };

  return (
    <div className="flex flex-col border-t border-gray-200 dark:border-gray-800">
      {/* Voice channel list */}
      <div className="p-2">
        <h3 className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Voice Channels
        </h3>
        {voiceRooms.map((room) => (
          <button
            key={room.id}
            onClick={() => handleJoin(room.id)}
            disabled={currentRoom?.id === room.id}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              currentRoom?.id === room.id
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{room.name}</span>
            {room.memberCount > 0 && (
              <span className="ml-auto text-xs text-gray-400">{room.memberCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Connected panel */}
      {currentRoom && (
        <div className="border-t border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="mb-2 px-2">
            <p className="text-xs font-medium text-green-600 dark:text-green-400">
              Voice Connected
            </p>
            <p className="truncate text-xs text-gray-500">{currentRoom.name}</p>
          </div>

          {/* Members */}
          <div className="mb-2 space-y-1 px-2">
            {currentRoom.members.map((member) => (
              <div key={member.userId} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <SpeakingIndicator isSpeaking={member.isSpeaking} />
                <span className="truncate">{member.userId}</span>
                {member.isMuted && <MicOff className="h-3 w-3 text-red-400" />}
                {member.isDeafened && <HeadphoneOff className="h-3 w-3 text-red-400" />}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={handleToggleMute}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                isMuted
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              onClick={toggleDeafen}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
              title="Deafen"
            >
              <Headphones className="h-4 w-4" />
            </button>

            <button
              onClick={handleLeave}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
              title="Disconnect"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
