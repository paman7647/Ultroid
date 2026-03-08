import { io, Socket } from 'socket.io-client';
import type { Logger } from 'pino';

interface BotEvent {
  type: string;
  botId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type CommandCallback = (roomId: string, command: string, args: string[], senderId: string) => void;

/**
 * MusicBot client — connects to the QWeb bot API and WebSocket.
 * Handles message sending, voice channel management, and event listening.
 */
export class MusicBotClient {
  private socket: Socket | null = null;
  private commandCallbacks: CommandCallback[] = [];
  private botId: string | null = null;

  constructor(
    private readonly apiUrl: string,
    private readonly wsUrl: string,
    private readonly token: string,
    private readonly logger: Logger,
  ) {}

  async connect() {
    // Verify the bot token and get bot info
    const res = await fetch(`${this.apiUrl}/bot-api/rooms`, {
      headers: { 'Bot-Token': this.token },
    });

    if (!res.ok) {
      throw new Error(`Failed to authenticate bot: ${res.status}`);
    }

    // Connect to WebSocket /bots namespace
    this.socket = io(`${this.wsUrl}/bots`, {
      auth: { token: this.token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.logger.info('Connected to WebSocket /bots namespace');
    });

    this.socket.on('disconnect', (reason) => {
      this.logger.warn({ reason }, 'WebSocket disconnected');
    });

    this.socket.on('bot:event', (event: BotEvent) => {
      this.logger.debug({ type: event.type }, 'Received bot event');

      if (event.type === 'COMMAND_RECEIVED') {
        const { command, args, senderId, roomId } = event.data as {
          command: string;
          args: string[];
          senderId: string;
          roomId: string;
        };

        for (const cb of this.commandCallbacks) {
          cb(roomId, command, args, senderId);
        }
      }
    });

    this.socket.on('connect_error', (err) => {
      this.logger.error({ err: err.message }, 'WebSocket connection error');
    });
  }

  onCommand(callback: CommandCallback) {
    this.commandCallbacks.push(callback);
  }

  async sendMessage(roomId: string, text: string) {
    const res = await fetch(`${this.apiUrl}/bot-api/messages`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomId, body: text }),
    });

    if (!res.ok) {
      this.logger.error({ status: res.status, roomId }, 'Failed to send message');
    }

    return res.json();
  }

  async joinVoice(voiceRoomId: string) {
    const res = await fetch(`${this.apiUrl}/bot-api/voice/join`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceRoomId }),
    });

    if (!res.ok) {
      this.logger.error({ status: res.status, voiceRoomId }, 'Failed to join voice');
    }

    return res.json();
  }

  async leaveVoice(voiceRoomId: string) {
    const res = await fetch(`${this.apiUrl}/bot-api/voice/leave`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceRoomId }),
    });
    return res.json();
  }

  async startStream(voiceRoomId: string, sourceUrl: string, source: 'FILE' | 'URL' = 'URL') {
    const res = await fetch(`${this.apiUrl}/bot-api/voice/stream/start`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceRoomId, sourceUrl, source }),
    });
    return res.json();
  }

  async stopStream(voiceRoomId: string) {
    const res = await fetch(`${this.apiUrl}/bot-api/voice/stream/stop`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceRoomId }),
    });
    return res.json();
  }

  async pauseStream(voiceRoomId: string) {
    const res = await fetch(`${this.apiUrl}/bot-api/voice/stream/pause`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceRoomId }),
    });
    return res.json();
  }

  async resumeStream(voiceRoomId: string) {
    const res = await fetch(`${this.apiUrl}/bot-api/voice/stream/resume`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceRoomId }),
    });
    return res.json();
  }

  async setVolume(voiceRoomId: string, volume: number) {
    const res = await fetch(`${this.apiUrl}/bot-api/voice/stream/volume`, {
      method: 'POST',
      headers: {
        'Bot-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceRoomId, volume }),
    });
    return res.json();
  }
}
