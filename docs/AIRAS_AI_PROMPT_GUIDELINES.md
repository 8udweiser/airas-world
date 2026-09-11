# 🌍 Airas（あいらす）公式 AI画像生成プロンプト設計ガイドライン（第2版）

本ドキュメントは、Airasの世界観に調和する高品質なドット絵（スプライトシート・オブジェクト・乗車モビリティ）を、Gemini（Nano Banana 2 / Imagen 3等）の画像生成AIで100%安定して創出するための**公式プロンプト設計ルール＆実践集**です。

---

## 1. 最重要グラフィックスタイル＆スケール規定

Airasの世界に配置されるアセットは、以下の原則を必ずプロンプトに含めてください。

### ① 世界グリッドとスケール対比（1マス = 32x32px基準）
ゲーム内のマップタイルは **1マス = 32x32px（実寸約1メートル想定）** です。キャラクターや乗り物の大きさが世界と自然に調和するよう、プロンプト内でスケール感を指示します。

| アセット種類 | 想定サイズ（ピクセル） | タイル換算 | 等身・スケール指示キーワード |
| :--- | :--- | :--- | :--- |
| **人間キャラクター** | 幅 20〜24px × **高さ 48〜50px** | 約 1.5マス高 | `2.5〜3等身`、`高さ48px比率`、`HD-2Dピクセルアート` |
| **自転車（日常・スポーツ）** | 幅 48〜52px × **高さ 32px** (側面) | 約 1.5 × 1マス | `自転車の全長約48px`、`車高32px比率`、`1マスサイズ` |
| **自動車（スーパーカー）** | 正面: 幅 58 × 高 38px / 側面: 幅 110 × 高 34px | 約 3.5 × 1マス | `車高38pxの低重心`、`ロングボディ` |
| **自販機・公衆電話** | 幅 32〜36px × **高さ 48〜52px** | 約 1 × 1.5マス | `高さ48px比率`、`街路設置用` |
| **公園ベンチ・街灯** | 幅 32〜40px × 高さ 18〜48px | 約 1〜1.5マス | `ベンチ座面高さ16px`、`街灯高さ48px` |

### ② 白残り（フチ・ハロー）ゼロ化のための背景規定
- **キーワード**: `背景は純粋な白一色（#FFFFFFの完全単色ベタ塗り）`, `ドロップシャドウや接地影は一切なし`, `グラデーションなし`, `切り抜き用ゲーム素材`
- **黒いクッキリ輪郭**: `キャラクターやパーツの外周は明瞭な濃色ピクセル輪郭（黒アウトライン）`
  - ※外周がクッキリしていると、AirasのBFS（外側洪水充填透過エンジン）がJPEG圧縮ノイズを完全に除去し、白い服の襟などを守りながら1ピクセルの白残りもなく綺麗に切り抜けます。

---

## 2. スプライトシート配置の黄金ルール

### 💡 なぜ「左向き」や「予備マス」を入れてはいけないのか？
1. **左と右の混同**: AIに「左」と「右」を同時に描かせると、高い確率で向きを取り違えたり、左右反転が逆になります。
2. **「予備」マスのコピペ問題**: 2行3列（6マス）で5ポーズを指定し、余った1マスを「予備」と指示すると、AIは直前の「右側面」をそのままコピペして穴埋めしてしまいます。

### 🌟 最も成功率が高い配置：【横一列 5方向】（または 3方向）
AIには**「右側面」および「右斜め（前・後）」のみ**を描かせ、**左側はAirasエンジンが完全に対称反転（Mirror Flip）**して自動生成します。

- 1番目: **正面向き（南）**
- 2番目: **背面向き（北）**
- 3番目: **右側面向き（東）** ➜ ※エンジンが反転して「左側面（西）」を自動生成
- 4番目: **斜め右前向き（南東）** ➜ ※エンジンが反転して「斜め左前（南西）」を自動生成
- 5番目: **斜め右後向き（北東）** ➜ ※エンジンが反転して「斜め左後（北西）」を自動生成

---

## 3. 実践お手本プロンプト集

---

### ① 【新登場・乗車可能】昭和レトロなママチャリ（日常系自転車）

街並みに完璧にマッチする、前カゴと荷台がついたノスタルジックな緑/銀色のママチャリ。

#### 日本語プロンプト（横一列・推奨）:
```text
16bitレトロゲーム風のドット絵スプライトシート。日本の昭和レトロな日常用自転車（ママチャリ）。
前カゴ付き、パイプフレーム（緑色）、サドル、ペダル、後部荷台、スタンド。
横一列に並んだゲーム素材（多方向スプライト）：
1. 正面向き（フロントビュー、前輪、ハンドル、前カゴが正面に見える、幅20px・高さ32px比率）
2. 背面向き（リアビュー、後輪、荷台、赤い反射板が後ろから見える、幅20px・高さ32px比率）
3. 右側面向き（サイドビュー、チェーンカバー、前後ホイールスポーク、全長48px・高さ32px比率）
4. 斜め右前向き（クォータービュー、ハンドルと前カゴが斜め右前を向いている）
5. 斜め右後向き（斜め後ろ姿、荷台が斜め右奥を向いている）
等間隔に配置、各アングルのスケール統一、車高は32px（ゲーム内1マス相当）、ドットの輪郭がシャープ、HD-2Dピクセルアート。
背景は純粋な白一色（#FFFFFFの完全単色ベタ塗り）、影なし、切り抜き用。
ネガティブ：同じ向きの重複、左向き、搭乗者（無人の自転車のみ）、3Dリアル写真、グラデーション背景
```

#### 英語プロンプト（Nano Banana 2 / Imagen 3 最高精度版）:
```text
16-bit retro pixel art sprite sheet of a classic Japanese city bicycle (mamachari).
Equipped with a front wire basket, green vintage frame, black saddle, pedals, rear luggage rack. No rider (empty bicycle).
A single horizontal row of 5 directions evenly spaced from left to right:
1. Front-facing view (South, width 20px, height 32px)
2. Back-facing view (North, width 20px, height 32px)
3. Right side profile view (East, full length 48px, height 32px)
4. Isometric diagonal front-right (South-East)
5. Isometric diagonal back-right (North-East)
Consistent scale, bicycle height is 32px, sharp pixel outlines, HD-2D retro game style.
Solid pure white background (#FFFFFF), no cast shadows, isolated for sprite sheet cropping.
```

---

### ② 【新登場・乗車可能】スポーティなクロスバイク / ロードバイク

爽快に街を駆け抜ける、ブルーフレームとドロップハンドルの軽量スポーツサイクル。

#### 日本語プロンプト:
```text
16bitレトロゲーム風のドット絵スプライトシート。軽量スポーツ自転車（クロスバイク・ロードバイク）。
鮮やかなブルーのダイヤモンドフレーム、細身のタイヤホイール、スポーティなサドル。無人の自転車。
横一列に並んだ多方向スプライト（全5アングル）：
1. 正面向き（フロントビュー、細いハンドルバーと前輪、車幅20px）
2. 背面向き（リアビュー、後輪とサドル後部、車幅20px）
3. 右側面向き（サイドビュー、スポーティなギアディレイラー、全長48px・車高32px）
4. 斜め右前向き（斜めフロントビュー）
5. 斜め右後向き（斜めリアビュー）
各方向のスケール統一、ドットの輪郭がシャープ、HD-2Dスタイル。
背景は純粋な白一色（#FFFFFFの完全単色ベタ塗り）、影なし、切り抜き用。
```

---

### ③ 【可愛い女子高生】8方向対応キャラクター（スケール最適化版）

ゲーム内の自販機（48px）や車（38px）と調和する、**高さ48〜50px（2.5〜3等身）**のスケール最適化プロンプト。

#### 日本語プロンプト:
```text
16bitレトロゲーム風のドット絵スプライトシート。可愛い日本の女子高生キャラクター（あおい）。
紺色セーラー服、赤いスカーフ、プリーツスカート、黒髪ボブカット、ローファー。
横一列に等間隔に並んだ5方向のゲーム素材：
1. 正面向き（南、前を向いて笑顔、立ち姿）
2. 背面向き（北、後ろ姿、髪の毛の後頭部）
3. 右側面向き（東、右を向いた真横のサイドプロファイル）
4. 斜め右前向き（南東、体を右斜め前に向けたクォータービュー）
5. 斜め右後向き（北東、体を右斜め後ろに向けたクォータービュー）
全ポーズの頭身とスケールを完全統一（2.5等身、高さ48px比率、幅約20px）、輪郭はクッキリとした黒ピクセルアウトライン、HD-2Dスタイル。
背景は純粋な白一色（#FFFFFFの完全単色ベタ塗り）、足元影なし、切り抜き用。
ネガティブ：同じ向きの重複、左向き、大人のリアル等身、ボケ、グラデーション背景
```

#### 英語プロンプト:
```text
16-bit retro pixel art character sprite sheet of a cute Japanese high school girl in sailor uniform.
Navy sailor suit, red ribbon, pleated skirt, brown bob hair, loafers.
A single horizontal row with 5 directions evenly spaced:
1. Front view (South)
2. Back view (North)
3. Right side profile (East)
4. Diagonal front-right (South-East)
5. Diagonal back-right (North-East)
Consistent 2.5-chibi head-to-body ratio, character height is strictly 48 pixels, crisp dark pixel outlines, HD-2D aesthetic.
Solid pure white background (#FFFFFF), no shadows, isolated for sprite cropping.
```

---

### ④ 【スーパーカー】ランボルギーニ・ウラカン（スケール最適化版）

```text
16bitレトロゲーム風のドット絵スプライトシート。黄色いランボルギーニ風スーパーカー。
横一列に並んだ3つの視点のゲーム素材：
1. 正面向き（フロントビュー、車幅58px・車高38px比率）
2. 背面向き（リアビュー、車幅58px・車高38px比率）
3. 右側面向き（右を向いたサイドビュー、全長110px・車高34pxのロングノーズ）
等間隔に配置、各アングルは完全に同じスケール、ドットの輪郭がシャープ、HD-2Dピクセルアート。
背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。
```

---

## 4. Airasへの取り込みと自動処理の流れ

1. 上記プロンプトでGeminiから画像を生成・保存します。
2. Airasの「AI世界生成 & 画像創出」画面に画像を投入すると：
   - **BFS外側洪水充填透過**: セーラー服の白い襟や自転車のスポーク内側を守りつつ、外周のJPEG圧縮白フチ（ハロー）を完全除去。
   - **水平自動反転（Mirroring）**: 右側面・斜め右向きから「左側面」「斜め左向き」を1ピクセルの狂いもなく自動生成。
   - **8方向コントローラー即時バインド**: 生成したその瞬間から、WASDで歩行・乗車して街中を駆け巡ることができます！

---

## 5. Airas公式 アンビエントBGM創出プロンプト集（第3版）

マインクラフトの音楽（C418 / Lena Raine）のように、**「何時間聴いていても邪魔にならず、心が洗われるような静けさ、開放感、雨の日に寄り添う優しさ」** を兼ね備えたBGMを、Google MusicFX、Suno、Udio、Gemini等の音楽AIで創出するための公式プロンプト集です。

### 音楽的特徴と設計パラメータ
- **ジャンル**: Ambient, Cinematic Neo-Classical, Chill Lo-Fi, Minimalist Piano
- **テンポ (BPM)**: 60 〜 72 BPM（心拍数と同期するゆったりしたリズム）
- **調性（Key）**: ハ長調（C Major）または イ短調（A Minor）のペンタトニック／長七度（Maj7th）
- **楽器構成**:
  - **フェルト・アップライトピアノ**: 弦とハンマーの間にフェルトを挟んだ、まろやかで温かい生ピアノの音。
  - **ローズ・エレクトリックピアノ (Rhodes)**: 鈴のような優しいベル成分とアコースティックな中音域。
  - **ウォーム・アナログシンセパッド**: ゆっくりとフィルターが開閉する、夕霧や空気のような包み込むアンビエント。
  - **雨と空気の質感 (Foley)**: 遠くの穏やかな雨音、テープの微かな揺らぎ（Wow/Flutter）。
- **音響空間**: 3〜4秒の豊かなコンボリューション・リバーブ、ステレオに広がる開放的なパノラマ空間。**ドラムや激しいビートは完全排除（No drums）**。

---

### ① 【雨天・静寂】濡れたアスファルトに寄り添うアンビエント・ピアノ

雨の街並み、傘を差して歩く女子高生、静まり返った駅前通りに最高の没入感をもたらす静穏なBGM。

#### 日本語プロンプト:
```text
マインクラフト（C418）スタイルの静かで癒されるアンビエント・ミニマルピアノ音楽。
62BPMの極めてゆったりしたテンポ。フェルトピアノの暖かく丸い打鍵音と、遠くで降り注ぐ穏やかな雨の環境音。
哀愁とノスタルジーの中に希望が広がるペンタトニック旋律。一音一音の間に長めの静寂（ポーズ）があり、深く澄み渡るリバーブの余韻が部屋全体を満たす。
ローズピアノと極めて静かなアナログシンセパッドが空間の開放感を演出。
ドラムなし、ビートなし、ボーカルなし。静寂、瞑想、雨の日のやすらぎ、HD-2DゲームBGM。
```

#### 英語プロンプト（Google MusicFX / Suno / Udio 最高精度版）:
```text
Minecraft style peaceful ambient piano music inspired by C418 and Lena Raine.
62 BPM, slow tempo. Warm felt acoustic upright piano notes played with generous breathing space between phrases.
Soft Rhodes electric piano bell tones, lush atmospheric analog synth pads with long filter sweep.
Subtle organic sound of gentle rain and gentle tape flutter in the background.
Open spatial acoustics, 4-second natural concert hall convolution reverb, spacious stereo field.
Nostalgic, meditative, melancholic yet uplifting, introspective.
Strictly NO drums, NO beats, NO percussion, NO bass drops, NO vocals.
```

---

### ② 【晴れ・開放感】どこまでも広がる空と世界を歩く旅の調べ

広大なマップを探索したり、スーパーカーでゆったりドライブする時に心が洗われる開放的なアンビエント。

#### 日本語プロンプト:
```text
広大なオープンワールドの開放感と自由を感じる、マインクラフト風の癒しアンビエントBGM。
68BPM。澄み渡るアコースティックグランドピアノと、陽光のように包み込む暖かなアンビエントシンセパッド。
心を解き放つメジャー7thコード進行。澄んだ青空、吹き抜ける風、緑の草原を思わせるアコースティックな響き。
豊かなステレオステレオ空間リバーブ、心地よい静寂、澄み切ったハイレゾ音響。
ドラムなし、パーカッションなし、エレクトロビートなし。癒し、探検、自由、HD-2Dオープンワールド。
```

#### 英語プロンプト:
```text
Expansive open-world ambient neoclassical soundtrack, C418 Minecraft Swedish style.
68 BPM. Crystal-clear acoustic grand piano playing gentle, uplifting major 7th chords.
Floating lush analog synthesizer drone, gentle wind chimes fading into deep stereo reverb.
Airy, panoramic soundstage giving a sense of endless open sky and limitless exploration.
Pure tranquility, warm sunshine, peaceful nostalgic adventure.
Completely drumless, percussion-free, beat-free, instrumental only.
```

---

## 6. ベンチ・屋外ストリート家具 創出プロンプト集（第4版）

Airasの世界でプレイヤーが腰掛けてひと休みしたり、飛び乗って遊べる **木製ベンチ（Park & Street Bench）** の生成プロンプトです。

### 📐 ベンチのスケーリング＆幾何学仕様
- **ゲーム内サイズ**: 幅48px × 高さ28px（横1.5マス、高さ1マス弱、座面高さ14px）
- **座面とアームレスト**:
  - キャラクター（幅20px）が中央に自然に座れる、奥行きのある木板座面。
  - 鋳鉄製の緑または濃灰色のクラシックな脚部と肘掛け。

---

### ① 【単体オブジェクト・正面＆クォータービュー】昭和レトロ木製ベンチ
プレイヤーが座る用途に最も適した、ノスタルジックな木板と鋳鉄脚の定番ベンチ。

#### 日本語プロンプト:
```text
16bitレトロゲーム風のドット絵。日本の公園や商店街にある昭和レトロな木製ベンチ。
ニス塗りの温かい木製スラット座面と背もたれ、深緑色の鋳鉄製アームレストと脚部。
やや斜め上から見下ろした2.5Dクォータービュー（幅48px・高さ26px比率）。
ドットの輪郭がシャープ、HD-2Dピクセルアート、ゲーム用マップオブジェクト素材。
無人のベンチ（誰も座っていない）。
背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。
```

#### 英語プロンプト:
```text
16-bit retro pixel art, Japanese Showa retro wooden park bench.
Varnished warm timber slats seat and backrest, dark forest green cast iron curved armrests and ornate legs.
2.5D top-down isometric quarter-view perspective (aspect ratio 48px width by 26px height).
Sharp pixel outlines, crisp HD-2D game asset sprite, unoccupied empty bench.
Pure solid white background (#FFFFFF flat color), no cast shadows, ready for alpha cutout.
```

---

### ② 【多方向スプライトシート】ベンチ3方向（正面・側面・斜め）
街角の向きに合わせて東西南北に配置するための3アングル素材。

#### 日本語プロンプト:
```text
16bitレトロゲーム風のドット絵スプライトシート。木製公園ベンチ。
横一列に並んだ3方向のゲーム素材：
1. 正面向き（フロントビュー、幅48px・高さ26px）
2. 側面向き（サイドビュー、横から見たL字型の木製座面、幅22px・高さ26px）
3. 斜め向き（クォータービュー、斜めから見た立体的な木板ベンチ）
等間隔に配置、各方向のスケール統一、ドットの輪郭がシャープ、HD-2Dスタイル。
無人のベンチ。背景は純粋な白一色（#FFFFFFの完全単色ベタ塗り）、影なし、切り抜き用。
```

---

## 7. 自転車「斜め前が生成されない問題」の徹底攻略ガイド

### 🧐 なぜ自転車の「斜め前」だけ何度やっても生成されないのか？
1. **開放フレーム構造（極細パイプ）の幾何学的難易度**:
   - 車や家などの「面の塊（ソリッド）」と異なり、自転車は「2本の薄い円形ホイール」と「細いパイプフレーム」で構成されています。
   - 正面（1本線）や真横（丸2つが並ぶ）はモデルにとって極めて学習密度が高く再現が容易ですが、**斜め前（クォータービュー）** は「手前の前輪と奥の後輪が楕円になり、フレームが遠近法で斜めに傾く」ため、生成AI（拡散モデル）の潜在空間で最も解像しにくい構造です。
2. **多方向スプライトシートの注意散漫（Attention Dilution）**:
   - 「正面、背面、右向き、斜め前、斜め後」と1枚の画像に複数アングルを同時に指定すると、モデルは描きやすい「真横」に強く引っ張られ、斜め前を要求しても勝手に真横や正面に歪んでしまいます。

### 💡 解決策：単体特化アングル生成（1枚1アングル）
シートではなく、**「斜め前（手前右向き）の自転車1台のみ」を狙い撃ちでプロンプトにする** ことで、AIが100%のリソースを斜め構造の描写に集中でき、一発で成功します！

---

### ① 【斜め前 単体特化】昭和レトロ日常ママチャリ（クォータービュー）

#### 日本語プロンプト:
```text
16bitレトロゲーム風のドット絵。日本の昭和レトロな日常用自転車（ママチャリ）。無人の自転車単体。
前輪が斜め右手前、後輪が斜め左奥を向いている、クォータービュー（斜め45度見下ろしアングル）。
前カゴ、パイプフレーム（緑色または紺色）、シルバーのハンドルバー、サドル、ペダル、後部荷台、スタンド。
2つの車輪が斜め前後の遠近感で立体的に並んで見える。
全長約44px・車高約30pxのゲーム内スケール比率、ドットの輪郭がシャープ、HD-2Dピクセルアート。
背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。
ネガティブ：真横の視点、真正面、搭乗者（人が乗っている）、3Dリアル写真、グラデーション背景。
```

#### 英語プロンプト:
```text
16-bit retro pixel art game sprite, single Japanese commuter bicycle (mamachari), riderless unoccupied.
Isometric 3/4 quarter view perspective, facing diagonally front-right: front wheel in the foreground right, rear wheel in the background left with clear depth perspective.
Front wire basket, curved green metal step-through frame, silver handlebars angled towards viewer, black saddle, pedals, rear luggage carrier.
Sharp crisp pixel borders, HD-2D sprite style (approx 44x30 px ratio).
Pure solid flat white background (#FFFFFF only), no shadows, clean cutout ready.
Negative prompt: flat side profile, direct front view, cyclist, rider, 3D photo render, messy gradients.
```

---

### ② 【斜め前 単体特化】スポーティなクロスバイク／ロードバイク

#### 日本語プロンプト:
```text
16bitレトロゲーム風のドット絵。軽量スポーツ自転車（クロスバイク・ロードバイク）。無人の自転車単体。
右斜め前を向いたクォータービュー（斜め45度見下ろし構図）。前輪が手前右、後輪が奥左にオフセットされた立体的なアングル。
鮮やかな青のダイヤモンドフレーム、細身のスポークホイール、ドロップハンドルバー、サドル。
ドットの輪郭がシャープ、HD-2Dピクセルアート、ゲーム用乗り物素材。
背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。
```
