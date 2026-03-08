export interface QueueItem {
  title: string;
  sourceUrl: string;
  source: 'FILE' | 'URL';
  requestedBy: string;
  duration?: number;
}

/**
 * Per-room music queue. Manages an ordered list of tracks per voice channel.
 */
export class MusicQueue {
  private queues = new Map<string, QueueItem[]>();
  private currentIndex = new Map<string, number>();
  private loopMode = new Map<string, 'off' | 'track' | 'queue'>();

  getQueue(roomId: string): QueueItem[] {
    return this.queues.get(roomId) ?? [];
  }

  add(roomId: string, item: QueueItem): number {
    const queue = this.queues.get(roomId) ?? [];
    queue.push(item);
    this.queues.set(roomId, queue);
    return queue.length;
  }

  remove(roomId: string, index: number): QueueItem | null {
    const queue = this.queues.get(roomId);
    if (!queue || index < 0 || index >= queue.length) return null;
    const [removed] = queue.splice(index, 1);

    const current = this.currentIndex.get(roomId) ?? 0;
    if (index < current) {
      this.currentIndex.set(roomId, current - 1);
    }
    return removed;
  }

  current(roomId: string): QueueItem | null {
    const queue = this.queues.get(roomId);
    const idx = this.currentIndex.get(roomId) ?? 0;
    return queue?.[idx] ?? null;
  }

  next(roomId: string): QueueItem | null {
    const queue = this.queues.get(roomId);
    if (!queue || queue.length === 0) return null;

    const loop = this.loopMode.get(roomId) ?? 'off';
    let idx = (this.currentIndex.get(roomId) ?? 0) + 1;

    if (loop === 'track') {
      idx = this.currentIndex.get(roomId) ?? 0;
    } else if (idx >= queue.length) {
      if (loop === 'queue') {
        idx = 0;
      } else {
        return null;
      }
    }

    this.currentIndex.set(roomId, idx);
    return queue[idx] ?? null;
  }

  skip(roomId: string, count = 1): QueueItem | null {
    const queue = this.queues.get(roomId);
    if (!queue || queue.length === 0) return null;

    const idx = Math.min((this.currentIndex.get(roomId) ?? 0) + count, queue.length - 1);
    this.currentIndex.set(roomId, idx);
    return queue[idx] ?? null;
  }

  clear(roomId: string) {
    this.queues.delete(roomId);
    this.currentIndex.delete(roomId);
  }

  shuffle(roomId: string) {
    const queue = this.queues.get(roomId);
    if (!queue || queue.length <= 1) return;

    const currentIdx = this.currentIndex.get(roomId) ?? 0;
    const currentItem = queue[currentIdx];

    // Fisher-Yates shuffle on items after current
    for (let i = queue.length - 1; i > currentIdx; i--) {
      const j = currentIdx + 1 + Math.floor(Math.random() * (i - currentIdx));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    // Ensure current item stays in position
    if (currentItem) {
      queue[currentIdx] = currentItem;
    }
  }

  setLoop(roomId: string, mode: 'off' | 'track' | 'queue') {
    this.loopMode.set(roomId, mode);
  }

  getLoop(roomId: string): 'off' | 'track' | 'queue' {
    return this.loopMode.get(roomId) ?? 'off';
  }

  size(roomId: string): number {
    return this.queues.get(roomId)?.length ?? 0;
  }

  position(roomId: string): number {
    return this.currentIndex.get(roomId) ?? 0;
  }
}
