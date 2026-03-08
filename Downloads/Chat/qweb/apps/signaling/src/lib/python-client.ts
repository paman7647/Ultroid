import axios, { AxiosInstance } from 'axios';
import { SignalingConfig } from './config';

export interface EncryptedMessageRecord {
  roomId: string;
  senderId: string;
  clientMsgId?: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  keyEnvelope: string;
  media: Array<{ blobKey: string; mimeType: string; size: number; thumbKey?: string }>;
}

export interface EncryptedMessageHistory {
  items: Array<{
    message_id: string;
    room_id: string;
    sender_id: string;
    client_msg_id?: string;
    ciphertext: string;
    iv: string;
    auth_tag: string;
    key_envelope: string;
    media: Array<{ blob_key: string; mime_type: string; size: number; thumb_key?: string }>;
    created_at: string;
  }>;
  next_cursor?: string | null;
}

export class PythonClient {
  private readonly client: AxiosInstance;

  constructor(config: SignalingConfig) {
    this.client = axios.create({
      baseURL: config.PYTHON_AI_URL,
      timeout: 8000,
      headers: {
        'x-internal-api-key': config.PYTHON_INTERNAL_API_KEY,
      },
    });
  }

  async authorizeRoom(roomId: string, userId: string): Promise<boolean> {
    const response = await this.client.get<{ authorized: boolean }>(`/v1/rooms/${roomId}/authorize/${userId}`);
    return response.data.authorized;
  }

  async createRoom(roomId: string, memberIds: string[]) {
    await this.client.post('/v1/rooms', { room_id: roomId, member_ids: memberIds });
  }

  async storeEncryptedMessage(payload: EncryptedMessageRecord) {
    const response = await this.client.post<{ message_id: string; created_at: string }>('/v1/messages/encrypted', {
      room_id: payload.roomId,
      sender_id: payload.senderId,
      client_msg_id: payload.clientMsgId,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      auth_tag: payload.authTag,
      key_envelope: payload.keyEnvelope,
      media: payload.media,
    });
    return response.data;
  }

  async setPresence(userId: string, status: 'online' | 'offline') {
    await this.client.post('/v1/presence', { user_id: userId, status });
  }

  async publishPublicKey(userId: string, algorithm: string, publicKey: string) {
    await this.client.put('/v1/keys/public', {
      user_id: userId,
      algorithm,
      public_key: publicKey,
    });
  }

  async getPublicKey(userId: string) {
    const response = await this.client.get<{
      user_id: string;
      algorithm: string;
      public_key: string;
      updated_at: string;
    }>(`/v1/keys/public/${userId}`);

    return response.data;
  }

  async getIceConfig() {
    const response = await this.client.get<{
      ice_servers: Array<{ urls: string[]; username?: string; credential?: string }>;
    }>('/v1/rtc/ice-servers');

    return response.data;
  }

  async listRoomMembers(roomId: string) {
    const response = await this.client.get<{ room_id: string; member_ids: string[] }>(`/v1/rooms/${roomId}/members`);
    return response.data;
  }

  async listEncryptedMessages(roomId: string, userId: string, cursor?: string, limit = 50) {
    const response = await this.client.get<EncryptedMessageHistory>(`/v1/messages/encrypted/${roomId}`, {
      params: {
        user_id: userId,
        cursor,
        limit,
      },
    });

    return response.data;
  }
}
