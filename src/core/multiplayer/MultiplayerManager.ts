import { Peer, DataConnection } from 'peerjs';
import { Direction } from '../types/world';

export interface RemotePlayerInfo {
  id: string;
  name: string;
  assetId: string;
  x: number;
  y: number;
  z: number;
  direction: Direction;
  isMoving: boolean;
  isSprinting: boolean;
  isDriving: boolean;
  isSitting: boolean;
  isSleeping: boolean;
  lastSeen: number;
  chatBubble?: { text: string; time: number } | null;
}

export interface PlayerPacket {
  type: 'player_sync' | 'chat_message' | 'player_leave';
  senderId: string;
  name: string;
  assetId: string;
  x: number;
  y: number;
  z: number;
  direction: Direction;
  isMoving: boolean;
  isSprinting: boolean;
  isDriving: boolean;
  isSitting: boolean;
  isSleeping: boolean;
  chatText?: string;
  timestamp: number;
}

class MultiplayerManager {
  public myId: string = `player_${Math.random().toString(36).substring(2, 8)}`;
  public myName: string = '旅人';
  public roomId: string = 'airas_main_room';

  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;

  public remotePlayers: Map<string, RemotePlayerInfo> = new Map();

  // コールバック
  public onRemotePlayersChange?: (players: RemotePlayerInfo[]) => void;
  public onChatReceived?: (senderName: string, text: string) => void;
  public onConnectionStatusChange?: (connectedCount: number, isOnline: boolean) => void;

  private isStarted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      if (room) {
        this.roomId = `airas_room_${room.trim()}`;
      }

      // スマホかどうかの簡易検出で名前をデフォルト決定
      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
      this.myName = isMobile ? 'スマホ冒険者' : 'PCプレイヤー';
    }
  }

  public init() {
    if (this.isStarted || typeof window === 'undefined') return;
    this.isStarted = true;

    // 1. BroadcastChannel (同一PC複数タブ用: 超爆速 0ms 同期)
    try {
      this.broadcastChannel = new BroadcastChannel(`airas_bc_${this.roomId}`);
      this.broadcastChannel.onmessage = (e) => {
        this.handleIncomingPacket(e.data);
      };
    } catch (_) {}

    // 2. WebRTC PeerJS (スマホとPC、他端末同士のリアルタイム同期)
    this.initPeerJS();

    // 3. 一定時間応答のない他プレイヤーの切断チェック
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.remotePlayers.entries()) {
        if (now - p.lastSeen > 6000) {
          this.remotePlayers.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.notifyPlayersChange();
      }
    }, 2000);
  }

  private initPeerJS() {
    try {
      const peerId = `${this.roomId}_${this.myId}`;
      const peer = new Peer(peerId, {
        debug: 1,
      });

      this.peer = peer;

      peer.on('open', (_id) => {
        this.connectToRoomMembers();
        this.onConnectionStatusChange?.(this.getConnectedCount(), true);
      });

      // 相手からのP2P接続受付
      peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      peer.on('error', (err) => {
        console.warn('[MultiplayerManager] Peer error:', err.type);
      });
    } catch (e) {
      console.warn('[MultiplayerManager] WebRTC init failed, using BroadcastChannel:', e);
    }
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.onConnectionStatusChange?.(this.getConnectedCount(), true);
    });

    conn.on('data', (data: any) => {
      this.handleIncomingPacket(data);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.onConnectionStatusChange?.(this.getConnectedCount(), true);
    });
  }

  private connectToRoomMembers() {
    const hostPeerId = `${this.roomId}_host`;
    if (this.peer && this.peer.id !== hostPeerId) {
      const hostConn = this.peer.connect(hostPeerId, { reliable: false });
      this.setupConnection(hostConn);
    }
  }

  private handleIncomingPacket(data: any) {
    if (!data || data.senderId === this.myId) return;

    if (data.type === 'player_sync') {
      const now = Date.now();
      const existing = this.remotePlayers.get(data.senderId);

      const info: RemotePlayerInfo = {
        id: data.senderId,
        name: data.name || '他プレイヤー',
        assetId: data.assetId || 'character_schoolgirl',
        x: data.x,
        y: data.y,
        z: data.z,
        direction: data.direction,
        isMoving: data.isMoving,
        isSprinting: data.isSprinting,
        isDriving: data.isDriving,
        isSitting: data.isSitting,
        isSleeping: data.isSleeping,
        lastSeen: now,
        chatBubble: existing?.chatBubble,
      };

      this.remotePlayers.set(data.senderId, info);
      this.notifyPlayersChange();
    } else if (data.type === 'chat_message') {
      const sender = this.remotePlayers.get(data.senderId);
      if (sender) {
        sender.chatBubble = { text: data.chatText || '', time: Date.now() };
        this.notifyPlayersChange();
      }
      this.onChatReceived?.(data.name || '誰か', data.chatText || '');
    } else if (data.type === 'player_leave') {
      this.remotePlayers.delete(data.senderId);
      this.notifyPlayersChange();
    }
  }

  private notifyPlayersChange() {
    this.onRemotePlayersChange?.(Array.from(this.remotePlayers.values()));
  }

  /**
   * 自分の最新状態を相手（スマホやPC）にブロードキャスト送信
   */
  public sendMyState(state: {
    assetId: string;
    x: number;
    y: number;
    z: number;
    direction: Direction;
    isMoving: boolean;
    isSprinting: boolean;
    isDriving: boolean;
    isSitting: boolean;
    isSleeping: boolean;
  }) {
    const packet: PlayerPacket = {
      type: 'player_sync',
      senderId: this.myId,
      name: this.myName,
      assetId: state.assetId,
      x: Math.round(state.x),
      y: Math.round(state.y),
      z: Math.round(state.z),
      direction: state.direction,
      isMoving: state.isMoving,
      isSprinting: state.isSprinting,
      isDriving: state.isDriving,
      isSitting: state.isSitting,
      isSleeping: state.isSleeping,
      timestamp: Date.now(),
    };

    // 1. BroadcastChannel へ送信
    try {
      this.broadcastChannel?.postMessage(packet);
    } catch (_) {}

    // 2. WebRTC P2P コネクションへ送信
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packet);
        } catch (_) {}
      }
    });
  }

  /**
   * チャットメッセージの送信
   */
  public sendChat(text: string) {
    if (!text.trim()) return;
    const packet: PlayerPacket = {
      type: 'chat_message',
      senderId: this.myId,
      name: this.myName,
      assetId: 'character_schoolgirl',
      x: 0,
      y: 0,
      z: 0,
      direction: 'down',
      isMoving: false,
      isSprinting: false,
      isDriving: false,
      isSitting: false,
      isSleeping: false,
      chatText: text.trim(),
      timestamp: Date.now(),
    };

    try {
      this.broadcastChannel?.postMessage(packet);
    } catch (_) {}

    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packet);
        } catch (_) {}
      }
    });
  }

  public getConnectedCount(): number {
    return this.remotePlayers.size;
  }

  public destroy() {
    try {
      this.broadcastChannel?.close();
      this.peer?.destroy();
    } catch (_) {}
    this.isStarted = false;
  }
}

export const multiplayerManager = new MultiplayerManager();
