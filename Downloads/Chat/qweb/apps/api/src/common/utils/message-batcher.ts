import type { Server } from 'socket.io';

/**
 * Batches WebSocket events destined for the same room and flushes
 * them as a single array payload on a short interval (50ms default).
 * This reduces the number of publish operations on the Redis adapter
 * and cuts per-event overhead for high-throughput rooms.
 *
 * Usage:
 *   const batcher = new MessageBatcher(server, 50);
 *   batcher.enqueue(roomId, 'message:new', payload);
 *   // … at flush time, clients receive { event: 'message:batch', data: [...] }
 */
export class MessageBatcher {
  private buffers = new Map<string, { event: string; data: unknown }[]>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly server: Server,
    private readonly flushIntervalMs = 50,
  ) {
    this.start();
  }

  enqueue(room: string, event: string, data: unknown): void {
    let buf = this.buffers.get(room);
    if (!buf) {
      buf = [];
      this.buffers.set(room, buf);
    }
    buf.push({ event, data });
  }

  private start(): void {
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  private flush(): void {
    for (const [room, items] of this.buffers) {
      if (items.length === 0) continue;

      if (items.length === 1) {
        // Single message — send normally
        const first = items[0]!;
        this.server.to(room).emit(first.event, first.data);
      } else {
        // Batch — emit as array
        this.server.to(room).emit('message:batch', items);
      }
    }
    this.buffers.clear();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush(); // flush remaining
  }
}
