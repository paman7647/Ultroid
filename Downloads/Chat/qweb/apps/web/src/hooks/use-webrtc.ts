'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/lib/socket-context';

interface PeerConnection {
  pc: RTCPeerConnection;
  userId: string;
}

interface UseWebRTCOptions {
  callId: string | null;
  localStream: MediaStream | null;
  namespace: 'call' | 'voice';
}

/**
 * Manages WebRTC peer connections for calls and voice rooms.
 * Handles offer/answer/ICE candidate exchange via Socket.IO signaling.
 */
export function useWebRTC({ callId, localStream, namespace }: UseWebRTCOptions) {
  const { callSocket, voiceSocket } = useSocket();
  const socket = namespace === 'call' ? callSocket : voiceSocket;
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]);

  // Fetch ICE servers from the API on mount
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiUrl}/media/ice-servers`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { iceServers: RTCIceServer[] }) => {
        if (data.iceServers) setIceServers(data.iceServers);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const createPeer = useCallback(
    (peerId: string, initiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers });

      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          const prefix = namespace === 'call' ? 'webrtc' : 'voice:webrtc';
          socket.emit(`${prefix}:ice-candidate`, {
            callId,
            targetUserId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(peerId, stream);
            return next;
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          removePeer(peerId);
        }
      };

      peersRef.current.set(peerId, { pc, userId: peerId });

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription && socket) {
              const prefix = namespace === 'call' ? 'webrtc' : 'voice:webrtc';
              socket.emit(`${prefix}:offer`, {
                callId,
                targetUserId: peerId,
                sdp: pc.localDescription.sdp,
                type: pc.localDescription.type,
              });
            }
          });
      }

      return pc;
    },
    [callId, localStream, socket, iceServers, namespace],
  );

  const removePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.pc.close();
      peersRef.current.delete(peerId);
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!socket || !callId) return;

    const prefix = namespace === 'call' ? 'webrtc' : 'voice:webrtc';

    const onOffer = async (data: { fromUserId: string; sdp: string; type: RTCSdpType }) => {
      let peer = peersRef.current.get(data.fromUserId);
      if (!peer) {
        const pc = createPeer(data.fromUserId, false);
        peer = { pc, userId: data.fromUserId };
      }
      await peer.pc.setRemoteDescription(new RTCSessionDescription({ sdp: data.sdp, type: data.type }));
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      socket.emit(`${prefix}:answer`, {
        callId,
        targetUserId: data.fromUserId,
        sdp: answer.sdp,
        type: answer.type,
      });
    };

    const onAnswer = async (data: { fromUserId: string; sdp: string; type: RTCSdpType }) => {
      const peer = peersRef.current.get(data.fromUserId);
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription({ sdp: data.sdp, type: data.type }));
      }
    };

    const onIceCandidate = async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      const peer = peersRef.current.get(data.fromUserId);
      if (peer) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    // When a new participant joins, initiate a connection
    const joinEvent =
      namespace === 'call' ? 'call:participant-joined' : 'voice:member-joined';
    const onPeerJoined = (data: { userId?: string; member?: { userId: string } }) => {
      const peerId = data.userId ?? data.member?.userId;
      if (peerId) createPeer(peerId, true);
    };

    const leaveEvent =
      namespace === 'call' ? 'call:participant-left' : 'voice:member-left';
    const onPeerLeft = (data: { userId: string }) => {
      removePeer(data.userId);
    };

    socket.on(`${prefix}:offer`, onOffer);
    socket.on(`${prefix}:answer`, onAnswer);
    socket.on(`${prefix}:ice-candidate`, onIceCandidate);
    socket.on(joinEvent, onPeerJoined);
    socket.on(leaveEvent, onPeerLeft);

    return () => {
      socket.off(`${prefix}:offer`, onOffer);
      socket.off(`${prefix}:answer`, onAnswer);
      socket.off(`${prefix}:ice-candidate`, onIceCandidate);
      socket.off(joinEvent, onPeerJoined);
      socket.off(leaveEvent, onPeerLeft);

      // Cleanup all peer connections
      for (const [, peer] of peersRef.current) {
        peer.pc.close();
      }
      peersRef.current.clear();
      setRemoteStreams(new Map());
    };
  }, [socket, callId, createPeer, removePeer, namespace]);

  const addStream = useCallback(
    (stream: MediaStream) => {
      for (const [, peer] of peersRef.current) {
        for (const track of stream.getTracks()) {
          peer.pc.addTrack(track, stream);
        }
      }
    },
    [],
  );

  const replaceTrack = useCallback(
    async (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack) => {
      for (const [, peer] of peersRef.current) {
        const sender = peer.pc.getSenders().find((s) => s.track === oldTrack);
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }
    },
    [],
  );

  return { remoteStreams, createPeer, removePeer, addStream, replaceTrack };
}

/**
 * Hook to manage local media streams (camera, microphone, screen share).
 */
export function useMediaStream() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const startMedia = useCallback(async (video: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: video
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          }
        : false,
    });
    setLocalStream(stream);
    return stream;
  }, []);

  const stopMedia = useCallback(() => {
    if (localStream) {
      for (const track of localStream.getTracks()) {
        track.stop();
      }
      setLocalStream(null);
    }
  }, [localStream]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        track.enabled = !track.enabled;
      }
      setIsMuted((prev) => !prev);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      for (const track of localStream.getVideoTracks()) {
        track.enabled = !track.enabled;
      }
      setIsVideoOff((prev) => !prev);
    }
  }, [localStream]);

  const startScreenShare = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' } as MediaTrackConstraints,
      audio: true,
    });
    setScreenStream(stream);

    // Handle when user stops sharing via browser UI
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        setScreenStream(null);
      };
    }

    return stream;
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      for (const track of screenStream.getTracks()) {
        track.stop();
      }
      setScreenStream(null);
    }
  }, [screenStream]);

  return {
    localStream,
    screenStream,
    isMuted,
    isVideoOff,
    startMedia,
    stopMedia,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  };
}
