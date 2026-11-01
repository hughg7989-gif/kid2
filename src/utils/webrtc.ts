/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Peer, { DataConnection } from 'peerjs';
import { MotionDataPayload } from '../types/game';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface NetworkManagerEvents {
  onStateChange: (state: ConnectionState, message?: string) => void;
  onDataReceived?: (data: MotionDataPayload) => void;
}

/**
 * Creates a readable 6-character session ID (e.g. "DRV924")
 */
export function generateSessionId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export class NetworkManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private state: ConnectionState = 'idle';
  private events: NetworkManagerEvents;
  public sessionId: string = '';
  public isHost: boolean = false;

  constructor(events: NetworkManagerEvents) {
    this.events = events;
  }

  private setState(state: ConnectionState, message?: string) {
    this.state = state;
    this.events.onStateChange(state, message);
  }

  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Host initializes PeerJS and listens for controller connections.
   */
  public initHost(customId?: string): string {
    this.isHost = true;
    this.sessionId = (customId || generateSessionId()).toUpperCase();
    this.setState('connecting', 'Starting session...');

    // Initialize local BroadcastChannel for local/multi-tab pairing
    try {
      this.broadcastChannel = new BroadcastChannel(`tinydrive_${this.sessionId}`);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'MOTION_DATA' && event.data.payload) {
          if (this.state !== 'connected') {
            this.setState('connected', 'Controller connected locally');
          }
          this.events.onDataReceived?.(event.data.payload);
        }
      };
    } catch {
      // BroadcastChannel not available in some restricted contexts
    }

    try {
      const peerId = `tinydrive-host-${this.sessionId}`;
      this.peer = new Peer(peerId, {
        debug: 1,
      });

      this.peer.on('open', (id) => {
        this.setState('idle', `Session ready: ${this.sessionId}`);
      });

      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this.setupConnectionHandlers(connection);
      });

      this.peer.on('error', (err) => {
        // If ID taken or server error, still allow local broadcast channel
        console.warn('PeerJS Host warning:', err.type, err.message);
        if (err.type === 'unavailable-id') {
          this.setState('idle', `Session ${this.sessionId} active`);
        } else {
          this.setState('error', `Connection error: ${err.message}`);
        }
      });
    } catch (e) {
      console.error('Failed to create PeerJS instance', e);
      this.setState('idle', `Session active locally (${this.sessionId})`);
    }

    return this.sessionId;
  }

  /**
   * Mobile Controller connects to Host session.
   */
  public connectToHost(sessionId: string) {
    this.isHost = false;
    this.sessionId = sessionId.trim().toUpperCase();
    this.setState('connecting', `Connecting to session ${this.sessionId}...`);

    // Setup local BroadcastChannel fallback
    try {
      this.broadcastChannel = new BroadcastChannel(`tinydrive_${this.sessionId}`);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'HOST_ACK') {
          this.setState('connected', 'Connected to host display');
        }
      };
    } catch {
      // ignore
    }

    try {
      const controllerPeerId = `tinydrive-ctrl-${this.sessionId}-${Math.random().toString(36).substring(2, 7)}`;
      this.peer = new Peer(controllerPeerId, {
        debug: 1,
      });

      this.peer.on('open', () => {
        const targetHostId = `tinydrive-host-${this.sessionId}`;
        const connection = this.peer!.connect(targetHostId, {
          reliable: false, // low latency for 60Hz motion data
        });
        this.conn = connection;
        this.setupConnectionHandlers(connection);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          this.setState('connecting', `Waiting for host screen (${this.sessionId})...`);
        } else {
          // Allow BroadcastChannel fallback for same-machine tabs
          this.setState('connecting', 'Linking via local channel...');
        }
      });
    } catch (e) {
      this.setState('connecting', 'Linking via local channel...');
    }
  }

  private setupConnectionHandlers(connection: DataConnection) {
    connection.on('open', () => {
      this.setState('connected', 'Controller connected');
      if (this.isHost) {
        connection.send({ type: 'HOST_ACK' });
      }
    });

    connection.on('data', (data: unknown) => {
      const msg = data as { type: string; payload: MotionDataPayload };
      if (msg && msg.type === 'MOTION_DATA' && msg.payload) {
        this.events.onDataReceived?.(msg.payload);
      }
    });

    connection.on('close', () => {
      this.setState('disconnected', 'Connection closed');
    });

    connection.on('error', (err) => {
      console.warn('Connection error:', err);
      this.setState('error', 'Data channel interrupted');
    });
  }

  /**
   * Sends motion data payload at 60Hz.
   */
  public sendMotionData(payload: MotionDataPayload) {
    // Send via WebRTC DataConnection
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'MOTION_DATA', payload });
    }

    // Also send via BroadcastChannel for zero-latency local fallback
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'MOTION_DATA', payload });
    }
  }

  public destroy() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // ignore
      }
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // ignore
      }
    }
  }
}
