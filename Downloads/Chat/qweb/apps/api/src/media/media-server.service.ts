import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export interface MediaServerConfig {
  host: string;
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
}

export interface RoomToken {
  token: string;
  wsUrl: string;
}

/**
 * LiveKit-compatible media server service.
 * When LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not set, falls back to
 * peer-to-peer mesh via the signaling server (suitable for ≤4 participants).
 */
@Injectable()
export class MediaServerService {
  private readonly logger = new Logger(MediaServerService.name);
  private readonly config: MediaServerConfig | null;

  constructor() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const host = process.env.LIVEKIT_HOST ?? 'http://localhost:7880';
    const wsUrl = process.env.LIVEKIT_WS_URL ?? 'ws://localhost:7880';

    if (apiKey && apiSecret) {
      this.config = { host, apiKey, apiSecret, wsUrl };
      this.logger.log('LiveKit SFU configured');
    } else {
      this.config = null;
      this.logger.warn('LiveKit not configured — falling back to P2P mesh');
    }
  }

  get isAvailable(): boolean {
    return this.config !== null;
  }

  /**
   * Generate a LiveKit-compatible access token for a participant.
   * Token grants: room join, publish audio/video/data, subscribe.
   */
  createRoomToken(
    roomName: string,
    participantIdentity: string,
    options?: {
      canPublish?: boolean;
      canSubscribe?: boolean;
      canPublishData?: boolean;
      canScreenShare?: boolean;
      metadata?: string;
    },
  ): RoomToken {
    if (!this.config) {
      throw new Error('LiveKit not configured');
    }

    const { canPublish = true, canSubscribe = true, canPublishData = true, canScreenShare = true, metadata } =
      options ?? {};

    // LiveKit access token format (JWT)
    const at = {
      iss: this.config.apiKey,
      sub: participantIdentity,
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      jti: crypto.randomUUID(),
      video: {
        room: roomName,
        roomJoin: true,
        canPublish,
        canSubscribe,
        canPublishData,
        canPublishSources: canScreenShare
          ? ['camera', 'microphone', 'screen_share', 'screen_share_audio']
          : ['camera', 'microphone'],
      },
      metadata,
    };

    const token = jwt.sign(at, this.config.apiSecret, { algorithm: 'HS256' });

    return { token, wsUrl: this.config.wsUrl };
  }

  /**
   * Create a room on the LiveKit server via its HTTP API.
   */
  async createRoom(roomName: string, options?: { emptyTimeout?: number; maxParticipants?: number }): Promise<void> {
    if (!this.config) return;

    const body = {
      name: roomName,
      emptyTimeout: options?.emptyTimeout ?? 300,
      maxParticipants: options?.maxParticipants ?? 100,
    };

    const serviceToken = this.createServiceToken();
    const url = `${this.config.host}/twirp/livekit.RoomService/CreateRoom`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Failed to create LiveKit room: ${text}`);
    }
  }

  /**
   * Remove a participant from a LiveKit room.
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    if (!this.config) return;

    const serviceToken = this.createServiceToken();
    const url = `${this.config.host}/twirp/livekit.RoomService/RemoveParticipant`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ room: roomName, identity }),
    });
  }

  /**
   * Delete a LiveKit room (kicks all participants).
   */
  async deleteRoom(roomName: string): Promise<void> {
    if (!this.config) return;

    const serviceToken = this.createServiceToken();
    const url = `${this.config.host}/twirp/livekit.RoomService/DeleteRoom`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ room: roomName }),
    });
  }

  /**
   * Get the TURN server configuration for P2P fallback.
   */
  getTurnConfig(): { urls: string; username: string; credential: string }[] | null {
    const turnUrl = process.env.TURN_URL;
    const turnUser = process.env.TURN_USERNAME;
    const turnPass = process.env.TURN_CREDENTIAL;

    if (!turnUrl) return null;

    return [
      {
        urls: turnUrl,
        username: turnUser ?? '',
        credential: turnPass ?? '',
      },
    ];
  }

  private createServiceToken(): string {
    if (!this.config) throw new Error('LiveKit not configured');

    const payload = {
      iss: this.config.apiKey,
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
      video: { roomAdmin: true, roomCreate: true, roomList: true },
    };

    return jwt.sign(payload, this.config.apiSecret, { algorithm: 'HS256' });
  }
}
