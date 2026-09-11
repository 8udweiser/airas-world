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
  isTyping?: boolean;
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
  isTyping?: boolean;
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
  public isHost: boolean = false;
  private isConnecting: boolean = false;
  private lastSendTime: number = 0;
  public isTyping: boolean = false;

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

      const customName = params.get('name');
      if (customName) {
        this.myName = customName.trim();
      } else {
        // スマホ実機 (iPhone, iPad, Android) かどうかの厳密な判定
        const ua = (navigator.userAgent || '').toLowerCase();
        const isActualMobile = /iphone|ipad|ipod|android|mobile/.test(ua) && window.innerWidth <= 1024;
        this.myName = isActualMobile ? 'スマホ冒険者' : 'PC冒険者';
      }
    }
  }

  public init() {
    if (this.isStarted || typeof window === 'undefined') return;

    // 🤖 自動テストランナー (Thorium Reviewer / Puppeteer / Playwright等) はマルチプレイヤーから除外
    // これにより、テスト実行時にテストブラウザが初期位置に居座ってゴーストキャラになるのを100%防止
    if ((navigator as any).webdriver || window.location.search.includes('nomultiplayer')) {
      console.log('[Multiplayer] 🤖 自動テスト環境のためマルチプレイヤー接続をスキップします');
      return;
    }

    this.isStarted = true;

    // 1. BroadcastChannel (同一PC複数タブ用: 超爆速 0ms 同期)
    try {
      this.broadcastChannel = new BroadcastChannel(`airas_bc_${this.roomId}`);
      this.broadcastChannel.onmessage = (e) => {
        this.handleIncomingPacket(e.data, false);
      };
    } catch (_) {}

    // 2. WebRTC PeerJS (スマホとPC、他端末同士のリアルタイムP2P同期)
    this.startPeerConnection();

    // 3. 一定時間応答のない他プレイヤーの切断チェック (2.0秒無通信で即座に退室判定)
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.remotePlayers.entries()) {
        if (now - p.lastSeen > 2000) {
          this.remotePlayers.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.notifyPlayersChange();
      }
    }, 600);

    // 4. タブ閉じ・リロード・画面離脱時の即時退出通知
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
      window.addEventListener('pagehide', () => this.destroy());
    }
  }

  /**
   * WebRTC P2P初期化 (ホスト立候補 -> 既にホストがいればクライアントとして接続)
   */
  private startPeerConnection() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const hostPeerId = `${this.roomId}_host`;
    const peerOptions = {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    };

    // まずホストとして立ち上げを試みる
    try {
      const hostPeer = new Peer(hostPeerId, peerOptions);

      hostPeer.on('open', (id) => {
        console.log('[Multiplayer] ✅ 自分がルームホストになりました:', id);
        this.peer = hostPeer;
        this.isHost = true;
        this.isConnecting = false;
        this.onConnectionStatusChange?.(this.getConnectedCount(), true);
      });

      hostPeer.on('connection', (conn) => {
        console.log('[Multiplayer] 👥 クライアントから接続を受けました:', conn.peer);
        this.setupConnection(conn);
      });

      hostPeer.on('error', (err: any) => {
        // すでにホストが存在している場合 (ID競合)
        if (err.type === 'unavailable-id') {
          console.log('[Multiplayer] ℹ️ 既にホストが存在します。クライアントとして参加します...');
          hostPeer.destroy();
          this.initAsClient(peerOptions);
        } else {
          console.warn('[Multiplayer] Host Peer error:', err.type, err);
          this.isConnecting = false;
        }
      });
    } catch (e) {
      console.warn('[Multiplayer] Host init failed, fallback to client:', e);
      this.initAsClient(peerOptions);
    }
  }

  /**
   * クライアントとして初期化し、ホストへ接続
   */
  private initAsClient(peerOptions: any) {
    const clientPeerId = `${this.roomId}_c_${this.myId}`;
    try {
      const clientPeer = new Peer(clientPeerId, peerOptions);
      this.peer = clientPeer;
      this.isHost = false;

      clientPeer.on('open', (id) => {
        console.log('[Multiplayer] 📱 クライアントPeerID取得:', id);
        this.isConnecting = false;
        // ホストへ接続
        const hostPeerId = `${this.roomId}_host`;
        const conn = clientPeer.connect(hostPeerId, { reliable: false });
        this.setupConnection(conn);
        this.onConnectionStatusChange?.(this.getConnectedCount(), true);
      });

      clientPeer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      clientPeer.on('error', (err: any) => {
        console.warn('[Multiplayer] Client Peer error:', err.type, err);
        this.isConnecting = false;
        // もしホストが切断されていた場合は再試行
        if (err.type === 'peer-unavailable') {
          setTimeout(() => {
            if (!this.peer || this.peer.destroyed) {
              this.startPeerConnection();
            }
          }, 3000);
        }
      });
    } catch (e) {
      console.warn('[Multiplayer] Client init failed:', e);
      this.isConnecting = false;
    }
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('[Multiplayer] 🔗 P2Pデータチャネル確立:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.onConnectionStatusChange?.(this.getConnectedCount(), true);

      // 初回接続時に即座に自分の情報を送信
      this.sendMyStateImmediate();
    });

    conn.on('data', (data: any) => {
      this.handleIncomingPacket(data, true);
    });

    conn.on('close', () => {
      console.log('[Multiplayer] 🔌 P2P切断:', conn.peer);
      this.connections.delete(conn.peer);
      this.onConnectionStatusChange?.(this.getConnectedCount(), true);

      // もしクライアント側でホストとの接続が切れた場合、ホスト再昇格を試行
      if (!this.isHost) {
        setTimeout(() => {
          if (this.connections.size === 0) {
            this.peer?.destroy();
            this.startPeerConnection();
          }
        }, 2000);
      }
    });

    conn.on('error', (err) => {
      console.warn('[Multiplayer] Connection error with', conn.peer, err);
    });
  }

  /**
   * 受信パケットの処理（ホストの場合は他クライアントへリレー転送）
   */
  private handleIncomingPacket(data: any, shouldRelay: boolean = false) {
    if (!data || data.senderId === this.myId) return;

    // 🔁 ホストの場合: 受信したパケットを接続中の全クライアント（送信元以外）にリレー転送
    if (this.isHost && shouldRelay) {
      this.connections.forEach((conn, peerId) => {
        if (conn.open && !peerId.includes(data.senderId)) {
          try {
            conn.send(data);
          } catch (_) {}
        }
      });
    }

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
        isTyping: !!data.isTyping,
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

  private lastMyState: any = null;

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
    this.lastMyState = state;
    const now = performance.now();

    // 重要アクション（ジャンプ中、乗車中、着席、就寝、スプリント開始など）の変化を検出
    const hasActiveAction = state.z > 0 || state.isDriving || state.isSitting || state.isSleeping;
    const throttleMs = hasActiveAction ? 25 : 35; // アクション中は約40fps、通常時は約28fpsで超軽快送信

    if (now - this.lastSendTime < throttleMs) {
      return;
    }
    this.lastSendTime = now;

    this.sendMyStateImmediate();
  }

  /**
   * キャッシュされた最新状態を即座に送信
   */
  public sendMyStateImmediate() {
    if (!this.lastMyState) return;
    const state = this.lastMyState;

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
      isTyping: this.isTyping,
      timestamp: Date.now(),
    };

    // 1. BroadcastChannel へ送信 (同一PCタブ間)
    try {
      this.broadcastChannel?.postMessage(packet);
    } catch (_) {}

    // 2. WebRTC P2P コネクションへ送信 (スマホ・PC間)
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packet);
        } catch (_) {}
      }
    });
  }

  /**
   * チャット入力状態（スマホアイコン）の即座ブロードキャスト
   */
  public setTypingStatus(isTyping: boolean) {
    if (this.isTyping === isTyping) return;
    this.isTyping = isTyping;
    this.sendMyStateImmediate();
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

  public broadcastLeave() {
    const packet: PlayerPacket = {
      type: 'player_leave',
      senderId: this.myId,
      name: this.myName,
      assetId: '',
      x: 0,
      y: 0,
      z: 0,
      direction: 'down',
      isMoving: false,
      isSprinting: false,
      isDriving: false,
      isSitting: false,
      isSleeping: false,
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

  public destroy() {
    try {
      this.broadcastLeave();
      this.broadcastChannel?.close();
      this.peer?.destroy();
    } catch (_) {}
    this.isStarted = false;
  }
}

export const multiplayerManager = new MultiplayerManager();
