import type { Logger } from 'pino';
import { MusicBotClient } from './client';
import { MusicQueue, QueueItem } from './queue';

/**
 * Handles all slash commands for the MusicBot.
 *
 * Commands:
 *   /play <url>           - Add a track and start playing
 *   /pause                - Pause current track
 *   /resume               - Resume playing
 *   /stop                 - Stop playback and leave voice
 *   /skip [count]         - Skip to next track(s)
 *   /queue                - Show current queue
 *   /nowplaying           - Show currently playing track
 *   /remove <index>       - Remove track from queue
 *   /clear                - Clear the queue
 *   /shuffle              - Shuffle upcoming tracks
 *   /loop <off|track|queue> - Set loop mode
 *   /volume <0-200>       - Set volume
 *   /join <voiceRoomId>   - Join a voice channel
 *   /leave                - Leave voice channel
 *   /help                 - Show commands
 */
export class CommandHandler {
  // Track which voice room the bot is in per chat room
  private voiceRoomMap = new Map<string, string>();

  constructor(
    private readonly client: MusicBotClient,
    private readonly queue: MusicQueue,
    private readonly logger: Logger,
  ) {}

  async handle(roomId: string, command: string, args: string[], senderId: string) {
    this.logger.info({ roomId, command, args, senderId }, 'Handling command');

    try {
      switch (command) {
        case 'play':
          await this.play(roomId, args, senderId);
          break;
        case 'pause':
          await this.pause(roomId);
          break;
        case 'resume':
          await this.resume(roomId);
          break;
        case 'stop':
          await this.stop(roomId);
          break;
        case 'skip':
          await this.skip(roomId, args);
          break;
        case 'queue':
          await this.showQueue(roomId);
          break;
        case 'nowplaying':
        case 'np':
          await this.nowPlaying(roomId);
          break;
        case 'remove':
          await this.remove(roomId, args);
          break;
        case 'clear':
          await this.clearQueue(roomId);
          break;
        case 'shuffle':
          await this.shuffle(roomId);
          break;
        case 'loop':
          await this.loop(roomId, args);
          break;
        case 'volume':
        case 'vol':
          await this.volume(roomId, args);
          break;
        case 'join':
          await this.join(roomId, args);
          break;
        case 'leave':
          await this.leave(roomId);
          break;
        case 'help':
          await this.help(roomId);
          break;
        default:
          await this.client.sendMessage(roomId, `Unknown command: \`/${command}\`. Use \`/help\` for a list of commands.`);
      }
    } catch (err: any) {
      this.logger.error({ err, command, roomId }, 'Command failed');
      await this.client.sendMessage(roomId, `Error: ${err.message}`);
    }
  }

  private async play(roomId: string, args: string[], senderId: string) {
    if (args.length === 0) {
      // Resume if paused
      const current = this.queue.current(roomId);
      if (current) {
        await this.resume(roomId);
        return;
      }
      await this.client.sendMessage(roomId, 'Usage: `/play <url>`');
      return;
    }

    const url = args[0];
    const title = args.slice(1).join(' ') || url;

    const item: QueueItem = {
      title,
      sourceUrl: url,
      source: 'URL',
      requestedBy: senderId,
    };

    const position = this.queue.add(roomId, item);
    await this.client.sendMessage(roomId, `Added to queue (#${position}): **${title}**`);

    // If this is the first track, start playing
    if (position === 1) {
      await this.startPlaying(roomId);
    }
  }

  private async startPlaying(roomId: string) {
    const voiceRoomId = this.voiceRoomMap.get(roomId);
    if (!voiceRoomId) {
      await this.client.sendMessage(roomId, 'Not in a voice channel. Use `/join <voiceRoomId>` first.');
      return;
    }

    const track = this.queue.current(roomId);
    if (!track) {
      await this.client.sendMessage(roomId, 'Queue is empty.');
      return;
    }

    await this.client.startStream(voiceRoomId, track.sourceUrl, track.source);
    await this.client.sendMessage(roomId, `Now playing: **${track.title}**`);
  }

  private async pause(roomId: string) {
    const voiceRoomId = this.voiceRoomMap.get(roomId);
    if (!voiceRoomId) {
      await this.client.sendMessage(roomId, 'Not in a voice channel.');
      return;
    }
    await this.client.pauseStream(voiceRoomId);
    await this.client.sendMessage(roomId, 'Paused.');
  }

  private async resume(roomId: string) {
    const voiceRoomId = this.voiceRoomMap.get(roomId);
    if (!voiceRoomId) {
      await this.client.sendMessage(roomId, 'Not in a voice channel.');
      return;
    }
    await this.client.resumeStream(voiceRoomId);
    await this.client.sendMessage(roomId, 'Resumed.');
  }

  private async stop(roomId: string) {
    const voiceRoomId = this.voiceRoomMap.get(roomId);
    if (voiceRoomId) {
      await this.client.stopStream(voiceRoomId);
      await this.client.leaveVoice(voiceRoomId);
      this.voiceRoomMap.delete(roomId);
    }
    this.queue.clear(roomId);
    await this.client.sendMessage(roomId, 'Stopped playback and cleared queue.');
  }

  private async skip(roomId: string, args: string[]) {
    const count = args.length > 0 ? Math.max(1, parseInt(args[0], 10) || 1) : 1;
    const next = this.queue.skip(roomId, count);

    if (!next) {
      await this.client.sendMessage(roomId, 'No more tracks in queue.');
      const voiceRoomId = this.voiceRoomMap.get(roomId);
      if (voiceRoomId) {
        await this.client.stopStream(voiceRoomId);
      }
      return;
    }

    await this.startPlaying(roomId);
  }

  private async showQueue(roomId: string) {
    const items = this.queue.getQueue(roomId);
    if (items.length === 0) {
      await this.client.sendMessage(roomId, 'Queue is empty.');
      return;
    }

    const pos = this.queue.position(roomId);
    const loop = this.queue.getLoop(roomId);
    const lines = items.map((item, i) => {
      const marker = i === pos ? '▶ ' : '  ';
      return `${marker}${i + 1}. **${item.title}**`;
    });

    const header = `**Music Queue** (${items.length} tracks, loop: ${loop})`;
    await this.client.sendMessage(roomId, `${header}\n${lines.join('\n')}`);
  }

  private async nowPlaying(roomId: string) {
    const track = this.queue.current(roomId);
    if (!track) {
      await this.client.sendMessage(roomId, 'Nothing is playing.');
      return;
    }

    const pos = this.queue.position(roomId);
    const total = this.queue.size(roomId);
    await this.client.sendMessage(
      roomId,
      `Now playing: **${track.title}** (${pos + 1}/${total})`,
    );
  }

  private async remove(roomId: string, args: string[]) {
    if (args.length === 0) {
      await this.client.sendMessage(roomId, 'Usage: `/remove <index>`');
      return;
    }

    const index = parseInt(args[0], 10) - 1;
    const removed = this.queue.remove(roomId, index);

    if (!removed) {
      await this.client.sendMessage(roomId, 'Invalid queue index.');
      return;
    }

    await this.client.sendMessage(roomId, `Removed: **${removed.title}**`);
  }

  private async clearQueue(roomId: string) {
    this.queue.clear(roomId);
    await this.client.sendMessage(roomId, 'Queue cleared.');
  }

  private async shuffle(roomId: string) {
    this.queue.shuffle(roomId);
    await this.client.sendMessage(roomId, 'Queue shuffled.');
  }

  private async loop(roomId: string, args: string[]) {
    const mode = (args[0] ?? 'off') as 'off' | 'track' | 'queue';
    if (!['off', 'track', 'queue'].includes(mode)) {
      await this.client.sendMessage(roomId, 'Usage: `/loop <off|track|queue>`');
      return;
    }
    this.queue.setLoop(roomId, mode);
    await this.client.sendMessage(roomId, `Loop mode: **${mode}**`);
  }

  private async volume(roomId: string, args: string[]) {
    if (args.length === 0) {
      await this.client.sendMessage(roomId, 'Usage: `/volume <0-200>`');
      return;
    }

    const vol = parseInt(args[0], 10);
    if (isNaN(vol) || vol < 0 || vol > 200) {
      await this.client.sendMessage(roomId, 'Volume must be between 0 and 200.');
      return;
    }

    const voiceRoomId = this.voiceRoomMap.get(roomId);
    if (!voiceRoomId) {
      await this.client.sendMessage(roomId, 'Not in a voice channel.');
      return;
    }

    await this.client.setVolume(voiceRoomId, vol);
    await this.client.sendMessage(roomId, `Volume set to **${vol}%**`);
  }

  private async join(roomId: string, args: string[]) {
    if (args.length === 0) {
      await this.client.sendMessage(roomId, 'Usage: `/join <voiceRoomId>`');
      return;
    }

    const voiceRoomId = args[0];

    // Leave previous voice room if any
    const prev = this.voiceRoomMap.get(roomId);
    if (prev) {
      await this.client.leaveVoice(prev);
    }

    await this.client.joinVoice(voiceRoomId);
    this.voiceRoomMap.set(roomId, voiceRoomId);
    await this.client.sendMessage(roomId, `Joined voice channel \`${voiceRoomId}\``);
  }

  private async leave(roomId: string) {
    const voiceRoomId = this.voiceRoomMap.get(roomId);
    if (!voiceRoomId) {
      await this.client.sendMessage(roomId, 'Not in a voice channel.');
      return;
    }

    await this.client.stopStream(voiceRoomId);
    await this.client.leaveVoice(voiceRoomId);
    this.voiceRoomMap.delete(roomId);
    this.queue.clear(roomId);
    await this.client.sendMessage(roomId, 'Left voice channel.');
  }

  private async help(roomId: string) {
    const helpText = [
      '**MusicBot Commands:**',
      '`/play <url> [title]` - Add a track and start playing',
      '`/pause` - Pause current track',
      '`/resume` - Resume playing',
      '`/stop` - Stop playback, clear queue, leave voice',
      '`/skip [count]` - Skip track(s)',
      '`/queue` - Show current queue',
      '`/nowplaying` - Show currently playing track',
      '`/remove <index>` - Remove track at position',
      '`/clear` - Clear the queue',
      '`/shuffle` - Shuffle upcoming tracks',
      '`/loop <off|track|queue>` - Set loop mode',
      '`/volume <0-200>` - Set volume',
      '`/join <voiceRoomId>` - Join a voice channel',
      '`/leave` - Leave voice channel',
    ].join('\n');

    await this.client.sendMessage(roomId, helpText);
  }
}
