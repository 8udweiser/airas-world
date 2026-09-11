# 🎮 Airas（あいらす）プラットフォーム仕様書 & AI共通アセット生成規格書
**Document Version:** 1.0.0  
**Target Environment:** Web (Vite + React + TypeScript + PixiJS v8 + TailwindCSS + PeerJS)  
**Supported Platforms:** PC (Windows/Mac/Linux), Mobile (iOS Safari/Android Chrome/Brave/Firefox/Edge/Opera)

---

## 1. 概要と目的
本書は、Airas（あいらす）ゲームプラットフォームの全体アーキテクチャ、物理演算、入力制御、マルチプレイヤー通信、および**他AI（Claude, GPT, Gemini等）でも同一条件・同一プラットフォーム上でゲーム世界やアセットを完全に再現・拡張・比較できる仕様書**です。

また、画像生成AI（Midjourney, Stable Diffusion, DALL-E 3, Imagen 3, Gemini等）を用いて新規アセットを創出する際、**背景透過処理（クロマキー除去）によってアセット本体に穴が空く（誤透過する）トラブルを100%防止する色保護設計ルール**を定義します。

---

## 2. コアアーキテクチャ仕様

### 2.1 グリッドと空間座標系
- **基本タイル**: 1タイル = **32 × 32 ピクセル**（ゲーム内実寸 1m 想定）
- **チャンク単位**: 1チャンク = **16 × 16 タイル**（512 × 512 ピクセル）
- **ワールド座標系**:
  - `x`: 水平右方向 (+)
  - `y`: 垂直下方向 (+)（地面の奥行きおよび足元接地ライン）
  - `z`: 高さ・垂直浮上方向 (+)（ジャンプ、屋根、立体交差、高架）
- **深度ソート（Y-Sorting）**:
  - `depthContainer` 内のスプライトは毎フレーム `worldFootY`（足元のワールドY座標）を基準に動的ソート。手前にあるオブジェクトが自然に奥のオブジェクトを遮蔽します。

### 2.2 物理・入力・カメラ制御
- **移動速度**: 通常歩行 230 px/s、ダッシュ 380 px/s、スニーク（しゃがみ） 110 px/s、車運転 540〜780 px/s
- **ジャンプ & 重力**: 初速 `vz = 300 px/s`、重力加速度 `gravity = 980 px/s²`
- **操作入力**:
  - **PCキーボード**: `WASD` / 矢印キー（移動）、移動キーダブルタップまたは `Ctrl`（ダッシュ）、`Shift`（しゃがみ/スニーク）、`Space`（ジャンプ）、`F`（乗車/降車/着席トグル）
  - **モバイルタッチ**: 全画面スワイプ移動（低速スワイプ=歩行、素早いフリック/大きくスワイプ=ダッシュ）、右下フローティングボタン群（🏎️ 乗る/降りる、🛋️ 座る/立つ、🏃 しゃがむ、🦘 JUMP）
- **全ブラウザ対応ジェスチャ抑止 (Chrome, Brave, Firefox, Opera, Edge, Safari)**:
  - `touch-action: none !important;` および `overscroll-behavior: none !important;` を `html, body, #root, canvas` に適用。
  - 画面外周 35px からのスワイプ戻る/進む、プルダウン更新、マルチタッチ（2本指以上）によるピンチズーム、Ctrl+Wheel拡大を JavaScript イベントリスナーで完全無効化。
  - チャット履歴やモーダル等のスクロール可能領域のみ `.allow-scroll` クラスで安全にスクロールを許可。

### 2.3 Undo / Redo（履歴管理）仕様
- **コマンドパターン**: すべてのワールド編集（タイル配置、オブジェクト生成、削除、移動、天候変更）は `IWorldCommand` インターフェースを介して実行。
- **オブジェクトドラッグ移動の1-Undo集約**:
  - ドラッグ中（ポインタ移動中）はストアの座標のみを直接更新（`updateObjectPositionDirect`）し、コマンド履歴を生成しない。
  - 指やマウスを離した瞬間（`pointerup`）に、ドラッグ開始位置 `(startX, startY)` から最終ドロップ位置 `(endX, endY)` への**単一の `MoveObjectCommand` を1回のみ発行**。
  - これにより、何秒間ドラッグ移動させても、**1回のUndo（Ctrl+Z）で元の位置に一発で復元**されます。

### 2.4 マルチプレイヤー同期（P2P & BroadcastChannel）
- **通信レイヤー**:
  - 同一ブラウザ内タブ間: `BroadcastChannel` による超低遅延（0ms）同期
  - 別端末（スマホ ⇆ PC）間: `PeerJS`（WebRTC DataChannel）によるダイレクトP2P同期
- **切断・ゴースト防止**:
  - `beforeunload` および `pagehide` イベントで退出パケット（`player_leave`）を即時ブロードキャスト。
  - 心拍タイムアウト（2.8秒無通信）により、切断された他プレイヤーのスプライトは即座にステージから消去され、初期スポーン位置等にキャラが残留するバグを根絶。

---

## 3. ベンチ・着席インタラクション仕様

### 3.1 仕様概要
プレイヤーが街中のベンチに近づいてリラックスできるマインクラフト風インタラクションです。

| 項目 | 設定値 |
| :--- | :--- |
| **ベンチの当たり判定** | 幅 48px × 奥行き 14px（背もたれ側は進入不可、手前座面は侵入可能） |
| **座面高さ (Z)** | `z: 6px` |
| **プレイヤー着席オフセット** | `x: bench.x`, `y: bench.y - 2px`, `z: 6px` |
| **自動着席検知距離** | **55 ピクセル以内** |

### 3.2 しゃがみ連動 自動着席ロジック
- プレイヤーがベンチの 55px 以内にいる状態で **しゃがみキー（PC: Shift / スマホ: 「しゃがむ」ボタン）** を押すと、即座にベンチ座面に腰掛けます（`toggleSit` 発動）。
- 着席時はキャラのスプライト姿勢が自然な腰掛けポーズ（幅 95%、高さ 82%、アンカー Y 0.84）に変化し、足元にベンチ座面との一体影が描画されます。
- 着席状態の解除: 移動キー（WASD / スワイプ）またはジャンプ（Space / JUMPボタン）を押すと自然に立ち上がります。

---

## 4. ベンチ画像生成プロンプト ＆ 透過色保護（クロマキー）規定

### 4.1 ⚠️ 透過色カブリ（誤透過・穴あき）の絶対防止ルール
画像生成AIで生成したアセットをゲーム内に取り込む際、背景を特定の色（クロマキー色）で生成し、自動で透過処理を行うワークフローを使用します。

> **誤透過の事故原因:**  
> 背景に「マゼンタ（#FF00FF）」を指定したにもかかわらず、ベンチ本体の木目、金具、ボルト、反射光、影にピンクや紫、マゼンタ系の色味が混ざっていると、**背景色透過スクリプトがベンチ本体の一部まで透明化し、ベンチに穴が空いてしまいます。**

#### 🛡️ 色保護のための厳格な制約
1. **背景色の指定**:
   - `Solid uniform pure magenta background (#FF00FF / RGB: 255, 0, 255)`  
     （※または純粋な白一色 `#FFFFFF` / 完全単色ライムグリーン `#00FF00`）
2. **ベンチ本体の許容カラーパレット**:
   - **木材部（座面・背もたれ）**: 暖かみのあるナチュラルブラウン、栗色、オーク、飴色、マホガニー（`#8B4513`, `#A0522D`, `#CD853F`, `#D2691E`, `#5C3317`）
   - **金属フレーム・脚・肘掛け**: 鋳鉄ブラック、チャコールグレー、ダークスレート（`#1C1C1E`, `#2C2C2E`, `#3A3A3C`）
   - **金具・ボルト**: アンティークブラス、くすんだゴールド（`#B8860B`, `#DAA520`）
3. **禁止色（ネガティブプロンプト必須）**:
   - `NO magenta, NO pink, NO purple, NO violet, NO fuchsia, NO neon colors anywhere on the bench object`
4. **境界線のクッキリ化**:
   - `Hard pixel boundaries, sharp crisp edges, NO drop shadow cast onto the background, NO ambient glow, NO semi-transparent anti-aliasing pixels around the silhouette`

---

### 4.2 実践画像生成プロンプト集

#### パターンA: 【クロマキーマゼンタ背景版（推奨・穴あき防止設計）】
木製スノコ座面と黒い鋳鉄フレームの美しい公園ベンチ。

##### 英語プロンプト (Midjourney / Stable Diffusion / DALL-E / Imagen 3用):
```text
16-bit pixel art asset of a classic wooden park bench, HD-2D retro game style, 3/4 top-down angled front-isometric view suitable for an RPG character to sit on.
Details: Polished warm oak wooden slat seat and backrest with rich amber brown woodgrain, elegant dark cast-iron curved armrests and ornamental black metal legs.
Perspective: Angled front view showing clear horizontal seat surface.
Background: Solid uniform flat pure neon magenta background (#FF00FF, rgb 255 0 255), single solid color background.
Strict Constraint: Crisp sharp pixel art silhouette, hard edges, clean cutout sprite.
Negative prompt: magenta, pink, purple, violet, fuchsia, neon on the bench, semi-transparent pixels, anti-aliasing against background, cast shadow on background, ambient glow, blur, modern plastic.
```

##### 日本語プロンプト (Gemini Nano Banana 2 / 日本語対応AI用):
```text
16bitレトロゲーム風のHD-2Dドット絵オブジェクト素材。公園や街路樹の木製ベンチ。
2.5D見下ろし（斜め上からのフロントアイソメトリック視点）、キャラクターが腰掛ける座面が水平に見える構図。
外観: 磨かれた温かみのあるオーク材の木製スノコ（座面と背もたれ）、アンバーブラウンの木目。フレーム・脚・肘掛けは重厚なダーク鋳鉄（黒鉄色）。
背景規定: 背景は完全な単色ベタ塗りの純粋なマゼンタ色（#FF00FF）。影やグラデーションは一切なし。
色保護制約: ベンチ本体（木部・鉄部・ボルト）にはマゼンタ、ピンク、紫、バイオレット系の色味を絶対に含めないこと。
外周はクッキリとした硬いピクセル輪郭線、アンチエイリアスによるボケ足なし、切り抜き用ゲームスプライト。
```

---

#### パターンB: 【完全白背景・ブラック輪郭版（Airas標準洪水充填透過エンジン用）】
Airas内蔵のBFS透過（外側白消去）エンジンに最適化された、フチ残りゼロの素材。

##### 英語プロンプト:
```text
Pixel art game sprite of a nostalgic retro park bench, 16-bit aesthetic, 2.5D top-down RPG perspective.
Warm chestnut wood slats, black forged iron frame, brass bolts.
Surrounded by a distinct, clean dark-pixel outline around the entire bench.
Background: Pure solid white (#FFFFFF) background, zero gradient, no cast shadow, isolated game asset ready for cutout.
Negative prompt: blurry, 3D render, photorealistic, cast shadow on ground, gray halo, gradient background.
```

##### 日本語プロンプト:
```text
16bitドット絵のゲームオブジェクト素材。昭和レトロな公園の木製ベンチ。
温かみのある栗色の木製スノコ座面、黒い鋳鉄の脚と肘掛け。キャラクターが座りやすい斜め見下ろしアングル。
外周全体がクッキリとした暗色ピクセル（黒アウトライン）で縁取られている。
背景は純粋な白一色（#FFFFFFの完全単色ベタ塗り）、地面への接地影やドロップシャドウは一切なし。白残りなく切り抜けるゲーム用素材。
```

---

## 5. アセット登録定義（JSONフォーマット）

生成したベンチアセットを `AirasAsset` としてゲーム内に追加する際の標準定義です：

```typescript
{
  id: 'furniture_park_bench_custom',
  name: '公園の木製ベンチ',
  category: 'furniture',
  type: 'object',
  sprite: {
    url: '/assets/sprites/furniture_bench_custom.png',
    width: 48,
    height: 32,
  },
  anchor: {
    x: 24, // 横中央
    y: 28, // 足元接地位置
  },
  collision: {
    enabled: true,
    offsetX: -20,
    offsetY: -8,
    width: 40,
    height: 14,
  },
  interactions: [
    {
      type: 'sit',
      label: '座る',
      offset: { x: 0, y: -2 },
    },
  ],
}
```

---

## 6. 他AIでの同条件再現・比較ベンチマーク用チェックリスト
他AI（Claude / GPT / Gemini等）で同等水準のゲームを構築・比較する際は、以下の機能要件が満たされているか確認してください：

1. [x] **低スペックPC対応**: 不要なRAF走査・毎フレームReact再描画を排除し、静的影/ライティング分離によりIntel内蔵GPUでも常時60FPSを維持できるか。
2. [x] **ドラッグ＆ドロップの1-Undo**: オブジェクト移動時に軌跡がUndoスタックを汚染せず、1回の操作としてUndo/Redoが可能か。
3. [x] **全ブラウザジェスチャ抑止**: モバイルの全主要ブラウザ（Chrome, Brave, Firefox, Opera, Edge, Safari）で戻るスワイプ・ピンチズーム・プルダウン更新が完全無効化されているか。
4. [x] **P2Pマルチプレイヤー**: サーバーを介さずWebRTCでスマホとPCが瞬時に同期し、退出時にゴーストキャラが残留しないか。
5. [x] **環境連動オーディオ**: 足音マテリアル判定（草・石・アスファルト・水・木）、雨音の強弱リアルタイム変調、雷鳴、空間リバーブが連動しているか。
6. [x] **アセット生成互換性**: クロマキー色保護ルールが明文化され、穴あきのないアセット生成が可能か。
7. [x] **操作モード分離**: 探索モードではオブジェクト上スワイプでプレイヤー移動、編集モードではオブジェクト掴み＆マス吸着（32pxスナップ）が正しく機能するか。
8. [x] **F3リアルタイム追従**: スマホ・PC移動時にXYZ座標が静止せず、レンダラーからミリ秒単位でリアルタイム更新されるか。
9. [x] **チャット改行制御**: Enterで改行し、送信はボタンまたはCtrl+Enterのみに制限されているか。

---

## 7. 探索モード vs 編集モードの入力分離 & UI制御仕様

### 7.1 探索モード（Play Mode）
- **目的**: 世界観への没入と、スマートフォン・PCでの誤操作のない快適な歩行・走行体験。
- **オブジェクト操作の無効化**: オブジェクトのドラッグ判定（`getEntityAtScreen`）をスキップ。
- **全画面スワイプ移動**: オブジェクト（家・木・ベンチ・車）の上からスワイプを開始しても、オブジェクトを掴むことなく直ちにプレイヤーの歩行・ダッシュが発動。
- **画面クリック移動（Auto-Walk）の完全廃止**: 画面タップによる勝手な自動歩行を排除し、プレイヤーの意志によるキーボード/スワイプ移動のみに制限。
- **HUD最適化**: スマホ版上部ヘッダーのUndo/Redoボタンを非表示にし、画面の視認性を最大化。

### 7.2 編集モード（Edit Mode）
- **目的**: 直感的なマップ作成、オブジェクトの自由配置、精密レイアウト。
- **オブジェクト操作の有効化**: 画面上のあらゆるオブジェクトをタップ＆ドラッグで自由に移動可能。
- **スワイプ移動の抑制**: オブジェクトの上からスワイプした際はオブジェクトドラッグが優先され、プレイヤーが勝手に歩き出さない。
- **マス吸着（グリッドスナップ）機能**:
  - 編集モード時、ヘッダーに「🧲 マス吸着」トグルボタンを表示。
  - **デフォルト: ON**（1マス = 32px 単位でピタッとスナップ配置）。
  - **トグル切替: OFF**（ピクセル単位の完全自由移動・微調整配置）。
- **Undo / Redo 表示**: スマホ・PCともにUndo/Redoボタンを表示し、1操作ごとに安全に履歴巻き戻しが可能。

---

## 8. チャット入力・コミュニケーション仕様
- **入力フィールド**: `<textarea>` による複数行入力対応。
- **改行動作**: `Enter` キー押下で自然に改行。意図しない誤送信を防止。
- **送信トリガー**: 「送信ボタン」のタップ/クリック、または `Ctrl + Enter`（Mac: `Cmd + Enter`）。
- **頭上吹き出しアニメーション**:
  - キャラクターの頭上に2行以内で表示。長文は上方向へスムーズに自動スクロール。
  - 全文字が表示完了してから10秒後に滑らかにフェードアウト。

---

## 9. F3 デバッグオーバーレイ仕様
- **リアルタイム性**: `requestAnimationFrame`（30〜60FPS）で `renderer.playerState` から直接 XYZ 座標、チャンク、Facing（方角）、State（Jumping/Sprinting/Sneaking/Walking/Standing/🚗 Driving/🛋️ Sitting）を取得・表示。
- **スマホ表示の最適化**:
  - スタイル: `bg-slate-950/50 backdrop-blur-sm text-[10px]`（半透明・コンパクト）。
  - 配置: `top-24 left-2`（2段ヘッダーと被らない安全位置）。
  - 不要なキーバインド一覧はスマホでは非表示にし、ゲーム画面の視認性を確保。
