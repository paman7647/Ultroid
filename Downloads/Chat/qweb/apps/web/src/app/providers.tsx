'use client';

import type { ReactNode } from 'react';
import { SocketProvider } from '@/lib/socket-context';

export function Providers({ children }: { children: ReactNode }) {
  return <SocketProvider>{children}</SocketProvider>;
}
