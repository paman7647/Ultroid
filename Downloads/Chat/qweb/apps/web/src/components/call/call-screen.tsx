'use client';

import { useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Hand,
  X,
} from 'lucide-react';
import { useCall } from '@/hooks/use-realtime';
import { useMediaStream, useWebRTC } from '@/hooks/use-webrtc';

function VideoTile({ stream, label, muted }: { stream: MediaStream | null; label: string; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video rounded-xl bg-gray-900 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="h-full w-full object-cover"
      />
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {label}
      </div>
    </div>
  );
}

export function CallScreen() {
  const {
    activeCall,
    incomingCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute: toggleCallMute,
    toggleVideo: toggleCallVideo,
    toggleScreenShare: toggleCallScreenShare,
  } = useCall();

  const {
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
  } = useMediaStream();

  const { remoteStreams } = useWebRTC({
    callId: activeCall?.callId ?? null,
    localStream,
    namespace: 'call',
  });

  // Start media when call becomes active
  useEffect(() => {
    if (activeCall && !localStream) {
      startMedia(activeCall.type === 'video');
    }
    return () => {
      if (!activeCall) stopMedia();
    };
  }, [activeCall?.callId]);

  // Incoming call overlay
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-gray-900 p-8 text-white shadow-2xl">
          <div className="h-20 w-20 animate-pulse rounded-full bg-green-500/20 flex items-center justify-center">
            <Phone className="h-10 w-10 text-green-400" />
          </div>
          <p className="text-lg font-medium">Incoming {incomingCall.type} call</p>
          <div className="flex gap-4">
            <button
              onClick={() => answerCall(incomingCall.callId)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
              title="Answer call"
            >
              <Phone className="h-6 w-6" />
            </button>
            <button
              onClick={() => rejectCall(incomingCall.callId)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              title="Reject call"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No active call
  if (!activeCall) return null;

  const handleToggleMute = () => {
    toggleMute();
    toggleCallMute();
  };

  const handleToggleVideo = () => {
    toggleVideo();
    toggleCallVideo();
  };

  const handleToggleScreenShare = async () => {
    if (screenStream) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
    toggleCallScreenShare();
  };

  const handleEndCall = () => {
    stopMedia();
    stopScreenShare();
    endCall();
  };

  const gridCols = Math.min(remoteStreams.size + 1, 3);
  const gridClassName =
    gridCols === 1 ? 'grid-cols-1' : gridCols === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Video grid */}
      <div className="flex-1 p-4">
        <div
          className={`grid h-full gap-2 ${gridClassName}`}
        >
          {/* Local video */}
          <VideoTile stream={localStream} label="You" muted />

          {/* Screen share */}
          {screenStream && <VideoTile stream={screenStream} label="Your Screen" muted />}

          {/* Remote participants */}
          {[...remoteStreams.entries()].map(([userId, stream]) => (
            <VideoTile key={userId} stream={stream} label={userId} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 bg-gray-900 px-6 py-4">
        <button
          onClick={handleToggleMute}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {activeCall.type === 'video' && (
          <button
            onClick={handleToggleVideo}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        )}

        <button
          onClick={handleToggleScreenShare}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            screenStream ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
          title={screenStream ? 'Stop sharing' : 'Share screen'}
        >
          {screenStream ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </button>

        <button
          onClick={handleEndCall}
          className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
          title="End call"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
