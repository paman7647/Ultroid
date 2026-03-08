'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/lib/socket-context';

export interface Presence {
  status: 'online' | 'offline' | 'away' | 'dnd';
  typing?: { roomId: string } | null;
  inCall?: string | null;
  inVoiceRoom?: string | null;
  lastSeenAt?: string;
}

/**
 * Track presence for a set of user IDs. Subscribes to real-time updates.
 */
export function usePresence(userIds: string[]): Map<string, Presence> {
  const { presenceSocket } = useSocket();
  const [presences, setPresences] = useState<Map<string, Presence>>(new Map());

  useEffect(() => {
    if (!presenceSocket || userIds.length === 0) return;

    // Fetch initial presence
    presenceSocket.emit('presence:get', { userIds }, (response: { data: Record<string, Presence> }) => {
      if (response?.data) {
        setPresences(new Map(Object.entries(response.data)));
      }
    });

    const onUpdate = (data: { userId: string; status: string; lastSeenAt?: string }) => {
      if (!userIds.includes(data.userId)) return;
      setPresences((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.userId) ?? { status: 'offline' as const };
        next.set(data.userId, {
          ...existing,
          status: data.status as Presence['status'],
          lastSeenAt: data.lastSeenAt ?? existing.lastSeenAt,
        });
        return next;
      });
    };

    presenceSocket.on('presence:update', onUpdate);
    return () => {
      presenceSocket.off('presence:update', onUpdate);
    };
  }, [presenceSocket, userIds.join(',')]);

  return presences;
}

export interface CallState {
  callId: string;
  roomId: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'active' | 'ended';
  participants: Array<{
    userId: string;
    status: string;
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    isHandRaised: boolean;
  }>;
}

/**
 * Manage call state: initiate, answer, reject, end, toggle controls.
 */
export function useCall() {
  const { callSocket } = useSocket();
  const [activeCall, setActiveCall] = useState<CallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    roomId: string;
    callerId: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    if (!callSocket) return;

    const onIncoming = (data: { callId: string; roomId: string; callerId: string; type: string }) => {
      setIncomingCall(data);
    };

    const onParticipantJoined = (data: { callId: string; participant: CallState['participants'][0] }) => {
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return { ...prev, participants: [...prev.participants, data.participant] };
      });
    };

    const onParticipantLeft = (data: { callId: string; userId: string }) => {
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return {
          ...prev,
          participants: prev.participants.filter((p) => p.userId !== data.userId),
        };
      });
    };

    const onParticipantUpdated = (data: {
      callId: string;
      userId: string;
      [key: string]: unknown;
    }) => {
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.userId === data.userId ? { ...p, ...data } : p,
          ),
        };
      });
    };

    const onEnded = (data: { callId: string }) => {
      if (activeCall?.callId === data.callId) {
        setActiveCall(null);
      }
      if (incomingCall?.callId === data.callId) {
        setIncomingCall(null);
      }
    };

    callSocket.on('call:incoming', onIncoming);
    callSocket.on('call:participant-joined', onParticipantJoined);
    callSocket.on('call:participant-left', onParticipantLeft);
    callSocket.on('call:participant-updated', onParticipantUpdated);
    callSocket.on('call:ended', onEnded);

    return () => {
      callSocket.off('call:incoming', onIncoming);
      callSocket.off('call:participant-joined', onParticipantJoined);
      callSocket.off('call:participant-left', onParticipantLeft);
      callSocket.off('call:participant-updated', onParticipantUpdated);
      callSocket.off('call:ended', onEnded);
    };
  }, [callSocket, activeCall?.callId, incomingCall?.callId]);

  const initiateCall = useCallback(
    (roomId: string, type: 'voice' | 'video') => {
      callSocket?.emit('call:initiate', { roomId, type }, (response: { data: { callId: string } }) => {
        if (response?.data) {
          setActiveCall({
            callId: response.data.callId,
            roomId,
            type,
            status: 'ringing',
            participants: [],
          });
        }
      });
    },
    [callSocket],
  );

  const answerCall = useCallback(
    (callId: string) => {
      callSocket?.emit('call:answer', { callId }, () => {
        if (incomingCall) {
          setActiveCall({
            callId,
            roomId: incomingCall.roomId,
            type: incomingCall.type as 'voice' | 'video',
            status: 'active',
            participants: [],
          });
          setIncomingCall(null);
        }
      });
    },
    [callSocket, incomingCall],
  );

  const rejectCall = useCallback(
    (callId: string) => {
      callSocket?.emit('call:reject', { callId });
      setIncomingCall(null);
    },
    [callSocket],
  );

  const endCall = useCallback(() => {
    if (!activeCall) return;
    callSocket?.emit('call:end', { callId: activeCall.callId });
    setActiveCall(null);
  }, [callSocket, activeCall]);

  const toggleMute = useCallback(() => {
    if (!activeCall) return;
    callSocket?.emit('call:toggle-mute', { callId: activeCall.callId });
  }, [callSocket, activeCall]);

  const toggleVideo = useCallback(() => {
    if (!activeCall) return;
    callSocket?.emit('call:toggle-video', { callId: activeCall.callId });
  }, [callSocket, activeCall]);

  const toggleScreenShare = useCallback(() => {
    if (!activeCall) return;
    callSocket?.emit('call:toggle-screen-share', { callId: activeCall.callId });
  }, [callSocket, activeCall]);

  return {
    activeCall,
    incomingCall,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  };
}

export interface VoiceRoomState {
  id: string;
  name: string;
  members: Array<{
    userId: string;
    isMuted: boolean;
    isDeafened: boolean;
    isSpeaking: boolean;
  }>;
}

/**
 * Voice room (Discord-style) controls.
 */
export function useVoiceRoom() {
  const { voiceSocket } = useSocket();
  const [currentRoom, setCurrentRoom] = useState<VoiceRoomState | null>(null);

  useEffect(() => {
    if (!voiceSocket) return;

    const onJoined = (data: VoiceRoomState) => setCurrentRoom(data);
    const onMemberJoined = (data: { voiceRoomId: string; member: VoiceRoomState['members'][0] }) => {
      setCurrentRoom((prev) => {
        if (!prev || prev.id !== data.voiceRoomId) return prev;
        return { ...prev, members: [...prev.members, data.member] };
      });
    };
    const onMemberLeft = (data: { voiceRoomId: string; userId: string }) => {
      setCurrentRoom((prev) => {
        if (!prev || prev.id !== data.voiceRoomId) return prev;
        return { ...prev, members: prev.members.filter((m) => m.userId !== data.userId) };
      });
    };
    const onMemberUpdated = (data: { voiceRoomId: string; userId: string; [key: string]: unknown }) => {
      setCurrentRoom((prev) => {
        if (!prev || prev.id !== data.voiceRoomId) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.userId === data.userId ? { ...m, ...data } : m,
          ),
        };
      });
    };
    const onSpeaking = (data: { voiceRoomId: string; userId: string; speaking: boolean }) => {
      setCurrentRoom((prev) => {
        if (!prev || prev.id !== data.voiceRoomId) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.userId === data.userId ? { ...m, isSpeaking: data.speaking } : m,
          ),
        };
      });
    };

    voiceSocket.on('voice:joined', onJoined);
    voiceSocket.on('voice:member-joined', onMemberJoined);
    voiceSocket.on('voice:member-left', onMemberLeft);
    voiceSocket.on('voice:member-updated', onMemberUpdated);
    voiceSocket.on('voice:speaking', onSpeaking);

    return () => {
      voiceSocket.off('voice:joined', onJoined);
      voiceSocket.off('voice:member-joined', onMemberJoined);
      voiceSocket.off('voice:member-left', onMemberLeft);
      voiceSocket.off('voice:member-updated', onMemberUpdated);
      voiceSocket.off('voice:speaking', onSpeaking);
    };
  }, [voiceSocket]);

  const joinRoom = useCallback(
    (voiceRoomId: string) => {
      voiceSocket?.emit('voice:join', { voiceRoomId });
    },
    [voiceSocket],
  );

  const leaveRoom = useCallback(() => {
    if (!currentRoom) return;
    voiceSocket?.emit('voice:leave', { voiceRoomId: currentRoom.id });
    setCurrentRoom(null);
  }, [voiceSocket, currentRoom]);

  const toggleMute = useCallback(() => {
    if (!currentRoom) return;
    voiceSocket?.emit('voice:mute', { voiceRoomId: currentRoom.id });
  }, [voiceSocket, currentRoom]);

  const toggleDeafen = useCallback(() => {
    if (!currentRoom) return;
    voiceSocket?.emit('voice:deafen', { voiceRoomId: currentRoom.id });
  }, [voiceSocket, currentRoom]);

  return { currentRoom, joinRoom, leaveRoom, toggleMute, toggleDeafen };
}
