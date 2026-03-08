'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface SocketContextValue {
  chatSocket: Socket | null;
  callSocket: Socket | null;
  voiceSocket: Socket | null;
  presenceSocket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  chatSocket: null,
  callSocket: null,
  voiceSocket: null,
  presenceSocket: null,
  connected: false,
});

export function useSocket() {
  return useContext(SocketContext);
}

function createSocket(namespace: string): Socket {
  return io(`${API_URL}${namespace}`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    autoConnect: false,
  });
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const chatRef = useRef<Socket | null>(null);
  const callRef = useRef<Socket | null>(null);
  const voiceRef = useRef<Socket | null>(null);
  const presenceRef = useRef<Socket | null>(null);

  useEffect(() => {
    const chat = createSocket('/chat');
    const call = createSocket('/calls');
    const voice = createSocket('/voice');
    const presence = createSocket('/presence');

    chatRef.current = chat;
    callRef.current = call;
    voiceRef.current = voice;
    presenceRef.current = presence;

    chat.on('connect', () => {
      console.log('[socket] chat connected, id:', chat.id);
      setConnected(true);
    });
    chat.on('disconnect', (reason) => {
      console.log('[socket] chat disconnected:', reason);
      setConnected(false);
    });
    chat.on('connect_error', (err) => {
      console.error('[socket] chat connect_error:', err.message);
    });

    chat.connect();
    call.connect();
    voice.connect();
    presence.connect();

    return () => {
      chat.disconnect();
      call.disconnect();
      voice.disconnect();
      presence.disconnect();
      chatRef.current = null;
      callRef.current = null;
      voiceRef.current = null;
      presenceRef.current = null;
      setConnected(false);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        chatSocket: chatRef.current,
        callSocket: callRef.current,
        voiceSocket: voiceRef.current,
        presenceSocket: presenceRef.current,
        connected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
