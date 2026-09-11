# Airas (アイラス) - 2.5D オープンワールド・AI生成ゲームプラットフォーム 仕様書

本仕様書は、2.5Dレトロ・ピクセルアートと現代的な動的ライティング・プロシージャル音響・リアルタイムP2Pマルチプレイヤーが融合したオープンワールドサンドボックスゲーム「**Airas**」の完全な技術仕様書です。  
他のAIアシスタントや開発者が本ドキュメントを参照することで、**同一条件・同一プラットフォームで完全に互換性のあるアプリケーションを再現・拡張・比較開発**できるように設計されています。

---

## 1. プロジェクト概要と設計哲学

### 1.1 概要
- **プロジェクト名称**: Airas (アイラス)
- **ジャンル**: 2.5D オープンワールド・AI世界生成サンドボックス RPG
- **動作プラットフォーム**: Webブラウザ (PC / スマートフォン / タブレット全対応)
- **ターゲット端末**: 低スペックノートPC（統合GPU / Core i3 / 8GB RAM）からゲーミングPC、モバイル端末まで、CPU負荷を最小化し安定した60FPSを実現。

### 1.2 コア設計思想
1. **圧倒的な軽快性と低スペック最適化 (GPU Offloading & Zero-Cost Layers)**:
   - 毎フレームのCPU頂点生成や走査を徹底排除し、静的影・静的ライティングはGPUテクスチャ/バッファにキャッシュ。
   - レンダリング解像度は `resolution: 1.0` に最適化し、高DPIディスプレイでのGPU過負荷（4倍〜9倍の描画負荷）を完全に防止。
2. **リアルな世界表現 (Wow Design & Immersion)**:
   - 街灯や自販機が周囲を温かく照らす **2.5Dライティング**。
   - 光源の方向に合わせてリアルに伸びる **指向性投影動的影 (Cast Shadows)**。
   - 自動で流れる **リアル水流・コースティクス光反射・水面波紋**。
   - 雨の強さに応じた無段階雨音・暴風・落雷閃光・水面足音による **現実感あふれる音響**。
3. **サンドボックスとインタラクティブ性**:
   - 空のバケツで川から水を汲み、地面に撒いて新しい清流を連結生成する **水流操作システム**。
   - 乗り物（スーパーカー爆走・ニトロ加速）、ベンチ着席、ダブルベッド同衾就寝。
4. **ゼロ・サーバー・マルチプレイヤー (WebRTC P2P + BroadcastChannel)**:
   - 外部ゲームサーバー不要。URL共有（QRコード/ワンクリックコピー）だけで、スマホとPCがP2Pでリアルタイム接続し、頭上チャットや同衾就寝が可能。

---

## 2. 技術スタック & 動作環境

| カテゴリ | 採用技術 | バージョン | 選定理由 |
| :--- | :--- | :--- | :--- |
| **言語** | TypeScript | ^5.6.x | 厳格な型安全性とリファクタリング耐性 |
| **フレームワーク** | React | ^18.3.x | コンポーネント指向UI、モーダル・HUD管理 |
| **ビルドツール** | Vite | ^6.x | 超高速ビルド、静的プレビュー配信 |
| **レンダラー** | PixiJS | ^8.x | 圧倒的描画性能、WebGL/WebGPU 自動選択、Yソート |
| **状態管理** | Zustand | ^4.5.x | 不要な再レンダリングを起こさない極小・高速ストア |
| **音響エンジン** | Web Audio API | 標準規格 | 外部音声ファイル不要のプロシージャル波形合成 + サンプラー |
| **マルチプレイヤー** | PeerJS (WebRTC) | ^1.5.x | サーバー不要のP2Pリアルタイム位置・向き・チャット同期 |
| **ローカル同期** | BroadcastChannel | 標準規格 | 同一ブラウザ内別タブ同士の0ms完全同期 |
| **スタイリング** | Tailwind CSS | ^3.4.x | 高速ユーティリティCSS、グラスモフィズム |
| **アイコン** | Lucide React | ^0.454.x | 軽量で洗練されたSVGベクターアイコン |

---

## 3. ディレクトリ構成

```text
Airas/
├── index.html                     # エントリーHTML (UTF-8, モバイル対応Viewport)
├── vite.config.ts                 # Viteビルド・プレビュー構成
├── tsconfig.json                  # TypeScript設定 (Strictモード)
├── package.json                   # パッケージ定義
├── SPECIFICATION.md              # 本仕様書
├── src/
│   ├── main.tsx                   # React ルートマウント
│   ├── App.tsx                    # メインオーケストレーター (全システム統合)
│   ├── index.css                  # グローバルCSS (軽量グラスモフィズム、フォント)
│   │
│   ├── core/                      # コアロジック (フレームワーク非依存)
│   │   ├── types/
│   │   │   ├── world.ts           # ワールド、タイル、エンティティ、天候型
│   │   │   ├── asset.ts           # アセット、当たり判定、インタラクション型
│   │   │   └── command.ts         # コマンドパターン (Undo/Redo) 型
│   │   ├── commands/
│   │   │   ├── CommandManager.ts  # コマンドスタック管理
│   │   │   └── WorldCommands.ts   # オブジェクト生成・移動・天候変更コマンド
│   │   ├── asset/
│   │   │   └── defaultAssets.ts   # 組み込みSVGアセット定義 (キャラ・家具・水・車)
│   │   ├── world/
│   │   │   └── initialWorld.ts    # 初期ワールドデータ (川、木橋、街灯、ベッド配置)
│   │   └── multiplayer/
│   │       └── MultiplayerManager.ts # WebRTC P2P + BroadcastChannel 同期
│   │
│   ├── renderer/                  # 描画層 (PixiJS 2.5D エンジン)
│   │   ├── IRenderer.ts           # レンダラー抽象インターフェース
│   │   └── pixi/
│   │       └── PixiWorldRenderer.ts # 2.5Dゲームループ、影、光、水流、深度ソート
│   │
│   ├── audio/                     # 音響層 (Web Audio API)
│   │   └── AudioManager.ts        # プロシージャル足音、雨音、落雷、BGMシャッフル
│   │
│   ├── store/                     # 状態管理 (Zustand)
│   │   ├── useWorldStore.ts       # ワールドデータ、タイル、エンティティ操作
│   │   └── useUIStore.ts          # HUD、パレット、モーダル、FPS状態
│   │
│   └── ui/                        # ユーザーインターフェース (React)
│       ├── hud/
│       │   ├── TopHUD.tsx         # 天候・BGM・カメラ・低負荷モード切り替えHUD
│       │   └── DebugOverlayF3.tsx # Minecraft風 F3 デバッグ情報オーバーレイ
│       ├── chat/
│       │   └── ChatSystem.tsx     # 頭上フキダシチャット & メッセージログ
│       ├── portal/
│       │   └── PortalLandingModal.tsx # 公開ポータル & スマホ接続共有
│       ├── editor/
│       │   └── AssetPaletteBar.tsx # アセットスロットパレット (1〜9キー対応)
│       ├── touch/
│       │   └── MobileTouchControls.tsx # スマホ用バーチャルジョイスティック
│       └── components/            # 各種モーダル (ヘルプ、設定、ダイアログ等)
```

---

## 4. データモデル & 型定義規約

### 4.1 ワールドデータモデル (`src/core/types/world.ts`)
```typescript
export type Direction = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';
export type WeatherType = 'clear' | 'sunset' | 'rain' | 'heavy_rain' | 'typhoon' | 'snow';

export interface AirasWorldData {
  id: string;
  name: string;
  version: string;
  map: {
    tileSize: number;   // 基本 32px
    chunkSize: number;  // 基本 16x16 タイル
    chunks: Record<string, WorldChunk>; // キー: "cx,cy"
  };
  entities: Record<string, WorldEntity>; // キー: entityId
  player: PlayerState;
  environment: {
    weather: WeatherType;
    time: number; // 0.0 〜 24.0
    ambientColor: string;
  };
}

export interface WorldChunk {
  cx: number;
  cy: number;
  tiles: TileData[][]; // [y][x]
}

export interface TileData {
  tileId: string; // 例: "tile_grass", "tile_water", "tile_road"
  elevation?: number;
}

export interface WorldEntity {
  id: string;
  assetId: string;
  name: string;
  type: 'object' | 'npc';
  position: { x: number; y: number; z: number };
  rotation?: number;
}
```

### 4.2 アセット定義規約 (`src/core/types/asset.ts`)
```typescript
export type AssetCategory = 'furniture' | 'nature' | 'infrastructure' | 'structure' | 'vehicle' | 'npc' | 'item';

export interface AirasAsset {
  id: string;
  name: string;
  category: AssetCategory;
  type: 'static' | 'animated' | 'character' | 'tile';
  sprite: {
    url: string; // SVG Data URL または WebP/PNG
    width: number;
    height: number;
    directionalUrls?: Partial<Record<Direction, string>>;
  };
  anchor: { x: number; y: number }; // 接地点 (ピボット): 足元中央
  collision?: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  };
  interactions?: InteractionDefinition[];
}

export interface InteractionDefinition {
  id: string;
  label: string;
  type: 'examine' | 'sit' | 'sleep' | 'drive' | 'scoop_water' | 'place_water';
  dialogue?: string[];
}
```

---

## 5. 2.5D レンダリングエンジン仕様 (PixiJS)

### 5.1 座標系と深度ソート (Y-sort)
- **座標軸**:
  - $X$: 東西方向（右が正）
  - $Y$: 南北方向（下が正、画面奥から手前）
  - $Z$: 高さ方向（上空が正、ジャンプや屋根上）
- **2.5D 見下ろし投影**:
  - 画面描画座標: $\text{ScreenX} = X \times \text{Zoom} + \text{CameraX}$
  - $\text{ScreenY} = (Y - Z) \times \text{Zoom} + \text{CameraY}$
- **深度整列 (Y-sort)**:
  - 接地点 $Y$ 座標（`worldFootY = entity.y`）が小さいオブジェクトを奥、大きいオブジェクトを手前に描画。
  - 移動中またはジャンプ中のみ 50ms 間隔で `depthContainer.children.sort()` を実行し、毎フレームのCPUソート負荷を完全排除。

### 5.2 低スペックGPU最適化アーキテクチャ
1. **静的レイヤーと動的レイヤーの完全分離**:
   - `staticShadowGraphics`: 建物・街路樹の接地影。ワールド配置変更時のみ1回描画（毎フレームCPU走査ゼロ）。
   - `staticLightingGraphics`: 街灯・自販機・喫茶店の光芒。天候・配置変更時のみ1回描画（毎フレームCPU走査ゼロ）。
   - `shadowGraphics`: プレイヤーの指向性投影影のみを毎フレーム描画（最寄り街灯1点のみ高速参照）。
   - `lightingGraphics`: プレイヤーの手持ちランタンのみを毎フレーム描画。
2. **水流アニメーションのカリング & 30Hz間引き**:
   - カメラの可視範囲（ビューポート）外の水タイルは走査を完全スキップ。
   - 頂点アニメーションは2フレームに1回（30FPS）に間引き、低負荷モード時はコースティクスパーティクルをスキップ。
3. **`app.init` オプション**:
   ```typescript
   await app.init({
     resizeTo: container,
     backgroundColor: 0x0f172a,
     resolution: 1.0,               // 高DPIでの多重負荷を完全防止
     autoDensity: true,
     antialias: false,              // ピクセルアートのシャープさを維持
     preference: 'webgl',
     powerPreference: 'high-performance', // 高性能GPUを優先割り当て
   });
   ```

### 5.3 視覚効果 (Visual Effects)
- **指向性投影影 (Cast Shadows)**:
  - 街灯（光源）とプレイヤーを結ぶベクトルの逆方向に影を投影。
  - 街灯に近いほど濃く短く、離れるほど長く伸びるリアルな減衰。
- **夜の街灯ライティング (2.5D Point Lights)**:
  - 中心核（強光: `0xffedd5`）、中間（温かいアンバー: `0xfde047`）、外周（柔らかな拡散光: `0xf59e0b`）の三重円による温かい街並み演出。
- **リアル水流 & 波紋**:
  - 川タイルの水色ハイライトが下流へ滑らかにスクロール。
  - プレイヤーが川に入ると、足元に楕円形の水面波紋（Ripple）が動的に拡大・フェードアウト。

---

## 6. プロシージャル音響システム仕様 (Web Audio API)

外部大容量音声ファイルに依存せず、ブラウザ内蔵の `AudioContext` による完全プロシージャル波形合成とハイファイサンプラーのハイブリッド構成。

### 6.1 足音エンジン (`playFootstep`)
足元のタイル材質 (`grass`, `stone`, `road`, `wood`, `water`) を判定し、リアルタイム合成：
- **`water` (水面)**: 高域バンドパスノイズ（バシャッ）＋低域サイン波（ポチャン）によるリアルな跳ね水音。
- **`stone` / `road`**: 短い衝撃ホワイトノイズ＋ハイシェルフフィルター。
- **`wood`**: 180Hz〜320Hz の温かいレゾナンス三角波。
- **`grass`**: ローパスノイズによる草の擦れ音。

### 6.2 動的天候環境音エンジン (`updateWeatherAmbient`)
- **雨音**: 多層ピンクノイズバッファを生成し、`BiquadFilterNode` でカットオフ周波数（1800Hz〜4200Hz）と音量を天候に応じてリアルタイム可変。
- **台風・暴風**: 超低域ピンクノイズ（60Hz〜180Hz）を LFO で揺らし、吹き荒れる風切り音を再現。
- **リアル落雷 (`playThunder`)**:
  - 放電クラック（1.5ms の短矩形パルス）＋超低音（45Hz 指数減衰サイン波）＋空間コンボリューションリバーブによる重厚な雷鳴。

### 6.3 自動ランダムBGMエンジン (Auto Shuffle Play)
- 起動時にランダムなトラックを自動選定。
- 曲の再生終了イベント（`ended`）を検知し、同一曲の連続を避けて自動で次の曲をランダムシャッフル再生。

---

## 7. WebRTC P2P マルチプレイヤー同期プロトコル

### 7.1 通信アーキテクチャ
- **BroadcastChannel API**: 同一PC上の複数タブ間通信（0ms 超爆速同期）。
- **PeerJS (WebRTC DataChannel)**: スマホ・PC・別端末間のP2P直接通信（サーバー不要）。
- **ルームID管理**: URLパラメータ `?room=xxxxx` で同一空間にマッチング。

### 7.2 同期パケット仕様
```typescript
interface PlayerPacket {
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
}
```
- **送信レート**: プレイヤー移動時・アクション時に最大 5.5Hz（180ms間隔）で間引き送信し、ネットワーク帯域とバッテリーを保護。
- **描画補間**: 受信側は線形補間＋歩行ボビング（`sin(Date.now() / 120) * 2`）で滑らかにレンダリング。

---

## 8. サンドボックス & インタラクション仕様

### 8.1 乗り物システム (スーパーカー爆走)
- **操作**: `F` キーまたは右クリックで乗降。
- **走行物理**: 加速度、慣性ドリフト、最高速 325km/h。
- **ニトロ加速**: `Shift` または `Ctrl` でニトロブースト。
- **効果音**: 実機録音V10エンジン（アイドリング・加速・高回転）の動的ピッチ制御。

### 8.2 家具 & 就寝システム (ダブルベッド同衾)
- **木製ベンチ**: `F` キーで着席・リラックス（[WASD]/[Space]で立ち上がり）。
- **ふかふかダブルベッド**:
  - `F` キーまたは右クリックで就寝。ベッド上に安らぎの姿勢で横たわり、専用就寝SEが再生。
  - マルチプレイヤー対応: 2人のプレイヤーが同時に同じダブルベッドで一緒に眠ることが可能。

### 8.3 バケツ & 水流操作システム (川作り)
- **水汲み**: パレットスロットで「空のバケツ (`tool_bucket_empty`)」を持ち、川面をクリック ➜ 水汲みSE再生 ➜ 「水入りバケツ (`tool_bucket_water`)」にアイテム変化。
- **水撒き・清流造成**: 「水入りバケツ」を持ち、地面をクリック ➜ 水撒きSE再生 ➜ 該当座標のタイルが瞬時に川タイル（`tile_water`）に変換され、水流アニメーションとリアル水面足音が即座に反映。川を自由に繋げて拡張可能。

---

## 9. AI世界生成連携プロトコル (Gemini API)

Gemini Multimodal API と連携して、テキストプロンプトからリアルタイムに世界を拡張可能：
1. **ワールドJSON生成**: 指定したテーマ（例: 「夜の秋葉原」「雨の温泉街」）に応じたタイルマップ・エンティティ配置JSONを出力。
2. **SVGアセット創出**: 新規オブジェクトやキャラクターのSVGコードを動的生成し、`defaultAssets` に動的登録。

---

## 10. 動作検証チェックリスト

他のAIや開発者が本仕様に基づき実装を検証する際は、以下の全項目が合格することを確認してください：
- [ ] `npm run build` がエラーゼロ（ExitCode 0）でビルド完了すること。
- [ ] 低スペックマシンにおいて Node.js のCPU使用率が 1% 未満に保たれること（プレビュー配信時）。
- [ ] WASD移動、クリック目的地自動歩行（Auto-Walk）が快適に動作すること。
- [ ] 雨・大雨・台風の天候変更時にリアルなプロシージャル雨音・風音・落雷が再生されること。
- [ ] 川の上を歩いた際、水面を跳ねるリアルな水しぶき足音が鳴ること。
- [ ] 街灯の光芒と、街灯から離れる方向に伸びる指向性投影影が正確に描画されること。
- [ ] 空バケツで水が汲め、水入りバケツで地面に水を撒いて川を繋げられること。
- [ ] ダブルベッドで就寝でき、起床操作が正常に行えること。
- [ ] スマホまたは別タブからアクセスした際、2人目のキャラクターが現れて位置・向き・頭上チャットがリアルタイム同期すること。
- [ ] BGMが自動でランダムシャッフル再生され、曲終了後に自動で次の曲へ移行すること。
