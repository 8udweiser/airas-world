import React, { useState, useEffect, useCallback } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { Undo2, Redo2, Sun, CloudRain, Snowflake, Sunset, Clock, Sparkles, HelpCircle, Compass, Wrench, Terminal, Key, Volume2, VolumeX, Music, SkipForward, Zap, CloudLightning } from 'lucide-react';
import { WeatherType } from '../../core/types/world';

interface TopHUDProps {
  onResetCamera: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onToggleF3: () => void;
  isF3Open: boolean;
  currentBgmTitle?: string;
  isBgmPlaying?: boolean;
  onToggleBgm?: () => void;
  onNextBgm?: () => void;
  isLowPerfMode?: boolean;
  onTogglePerfMode?: () => void;
  multiplayerSlot?: React.ReactNode;
}

export const TopHUD: React.FC<TopHUDProps> = ({
  onResetCamera,
  onOpenHelp,
  onOpenSettings,
  onToggleF3,
  isF3Open,
  currentBgmTitle,
  isBgmPlaying,
  onToggleBgm,
  onNextBgm,
  isLowPerfMode,
  onTogglePerfMode,
  multiplayerSlot,
}) => {
  const { world, canUndo, canRedo, undo, redo, setWeather, setTime } = useWorldStore();
  const { isAIPanelOpen, setAIPanelOpen, activeMode, setActiveMode, isMuted, toggleMute, isSnapToGrid, toggleSnapToGrid } = useUIStore();

  // 🕒 リアルタイム自動同期フラグ (デフォルトで現実のPC/スマホ時刻と自動連動)
  const [isRealtimeSync, setIsRealtimeSync] = useState<boolean>(true);

  // 現実世界の現在時刻を算出して world.environment.time に反映
  const syncToCurrentRealTime = useCallback(() => {
    const now = new Date();
    const realHours = now.getHours();
    const realMinutes = now.getMinutes();
    const realSeconds = now.getSeconds();
    const timeVal = realHours + realMinutes / 60 + realSeconds / 3600;
    setTime(Math.round(timeVal * 100) / 100);
  }, [setTime]);

  // 初回マウント時に現実時刻を適用
  useEffect(() => {
    syncToCurrentRealTime();
  }, [syncToCurrentRealTime]);

  // リアルタイム同期ON時の定期タイマー (15秒ごとに時刻チェックし分が変われば自動反映・CPU負荷ゼロ)
  useEffect(() => {
    if (!isRealtimeSync) return;
    const timer = setInterval(() => {
      syncToCurrentRealTime();
    }, 15000);
    return () => clearInterval(timer);
  }, [isRealtimeSync, syncToCurrentRealTime]);

  const weatherIcons: Record<WeatherType, { icon: React.ReactNode; label: string }> = {
    clear: { icon: <Sun className="w-4 h-4 text-amber-400" />, label: '快晴' },
    rain: { icon: <CloudRain className="w-4 h-4 text-sky-400" />, label: '雨' },
    heavy_rain: { icon: <CloudRain className="w-4 h-4 text-blue-400 animate-pulse" />, label: '大雨' },
    typhoon: { icon: <CloudLightning className="w-4 h-4 text-purple-300 animate-bounce" />, label: '台風' },
    snow: { icon: <Snowflake className="w-4 h-4 text-cyan-200" />, label: '雪' },
    sunset: { icon: <Sunset className="w-4 h-4 text-orange-400" />, label: '夕焼け' },
    fog: { icon: <Sun className="w-4 h-4 text-slate-300" />, label: '霧' },
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // 🌅 時間帯（早朝・朝・昼・夕方・夜）の視覚情報ヘルパー
  const getTimePeriodInfo = (time: number) => {
    if (time >= 4.5 && time < 7.0) {
      return { label: '早朝', icon: '🌅', color: 'text-indigo-300', bg: 'bg-indigo-950/70 border-indigo-500/40' };
    }
    if (time >= 7.0 && time < 11.0) {
      return { label: '朝', icon: '☀️', color: 'text-amber-300', bg: 'bg-amber-950/70 border-amber-500/40' };
    }
    if (time >= 11.0 && time < 16.5) {
      return { label: '昼', icon: '🌤️', color: 'text-sky-300', bg: 'bg-sky-950/70 border-sky-500/40' };
    }
    if (time >= 16.5 && time < 19.0) {
      return { label: '夕方', icon: '🌇', color: 'text-orange-300', bg: 'bg-orange-950/70 border-orange-500/40' };
    }
    return { label: '夜', icon: '🌙', color: 'text-blue-300', bg: 'bg-blue-950/70 border-blue-500/40' };
  };

  const periodInfo = getTimePeriodInfo(world.environment.time);

  return (
    <>
      {/* 📱 モバイル専用トップHUD (画面幅 < 640px: 2段構成で全機能が100%見えて押しやすい) */}
      <header
        className="sm:hidden absolute top-2 left-2 right-2 flex flex-col gap-1.5 pointer-events-none z-40"
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* 1段目: タイトル | ✨ AI世界生成 (中央特大) | 🔇 ミュート & 🎵 BGM & ⚡ 低負荷 */}
        <div className="flex items-center justify-between gap-1.5 pointer-events-auto">
          {/* 左: ロゴ */}
          <div className="glass-panel px-2 py-1 rounded-xl flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-white/15 shadow-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-extrabold tracking-wider text-xs bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
              Airas
            </span>
          </div>

          {/* 中央: ✨ AI世界生成 & 画像創出 ボタン (常時超目立つプレミアムグラデーション) */}
          <button
            onClick={() => setAIPanelOpen(!isAIPanelOpen)}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAIPanelOpen(!isAIPanelOpen);
            }}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer border ${
              isAIPanelOpen
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300 ring-2 ring-cyan-400/50'
                : 'bg-gradient-to-r from-cyan-600/90 via-sky-600/90 to-blue-600/90 text-white border-cyan-300/60 shadow-cyan-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span>AI世界生成</span>
          </button>

          {/* 右: 🔇 ミュート & 🎵 BGM & ⚡ 低負荷 (スマホでも絶対に見える！) */}
          <div className="glass-panel px-1.5 py-1 rounded-xl flex items-center gap-1 bg-slate-950/85 backdrop-blur-md border border-white/15 shadow-md">
            {/* サウンド ミュート / アンミュート */}
            <button
              onClick={() => toggleMute()}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMute();
              }}
              className={`p-1 rounded-lg transition-all active:scale-90 cursor-pointer ${
                isMuted
                  ? 'text-rose-400 bg-rose-500/30 border border-rose-400/50'
                  : 'text-cyan-300 hover:text-white'
              }`}
              title={isMuted ? 'サウンドをオンにする' : 'サウンドをミュートにする'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400 animate-pulse" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
            </button>

            {/* BGM トグル */}
            <button
              onClick={onToggleBgm}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleBgm?.();
              }}
              className={`p-1 rounded-lg transition-all active:scale-90 cursor-pointer ${
                isBgmPlaying ? 'text-amber-300' : 'text-slate-400'
              }`}
              title="BGM 再生/停止"
            >
              <Music className={`w-4 h-4 ${isBgmPlaying ? 'animate-bounce text-amber-400' : ''}`} />
            </button>

            {/* ⚡ 低負荷モード */}
            <button
              onClick={(e) => {
                (e.currentTarget as HTMLElement)?.blur();
                onTogglePerfMode?.();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement)?.blur();
                onTogglePerfMode?.();
              }}
              className={`p-1 rounded-lg transition-all active:scale-90 cursor-pointer ${
                isLowPerfMode ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400'
              }`}
              title="低負荷モード切替"
            >
              <Zap className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* 2段目: 探索 / 編集 モード切替 & (編集時: グリッド吸着 & Undo/Redo) & F3 (左) ｜ 待受中 / ポータル / キャラ変更 (右) */}
        <div className="flex items-center justify-between gap-1 w-full pointer-events-auto">
          {/* 左: 探索 / 編集 / (編集時のみ: 🧲吸着 & Undo & Redo) / F3 */}
          <div className="flex items-center p-0.5 bg-slate-950/85 backdrop-blur-md rounded-xl border border-white/15 shadow-md gap-0.5">
            <button
              onClick={() => setActiveMode('play')}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveMode('play');
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeMode === 'play'
                  ? 'bg-cyan-500/40 text-cyan-100 border border-cyan-400/50 shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>探索</span>
            </button>
            <button
              onClick={() => setActiveMode('edit')}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveMode('edit');
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeMode === 'edit'
                  ? 'bg-amber-500/40 text-amber-100 border border-amber-400/50 shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>編集</span>
            </button>

            {/* 🛠️ 編集モード時のみ表示: マス吸着トグル & Undo / Redo */}
            {activeMode === 'edit' && (
              <>
                <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />
                {/* 🧲 マス吸着トグル (デフォルトON) */}
                <button
                  onClick={() => toggleSnapToGrid()}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSnapToGrid();
                  }}
                  className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-0.5 ${
                    isSnapToGrid
                      ? 'bg-amber-500/40 text-amber-200 border border-amber-400/50'
                      : 'text-slate-400 bg-black/30 border border-white/5'
                  }`}
                  title={isSnapToGrid ? 'マス吸着: ON (32px)' : 'マス吸着: OFF (自由移動)'}
                >
                  <span>🧲</span>
                  <span className="text-[9px]">{isSnapToGrid ? '吸着' : '自由'}</span>
                </button>

                {/* 元に戻す (Undo) */}
                <button
                  onClick={() => undo()}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    undo();
                  }}
                  disabled={!canUndo}
                  className={`p-1 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    canUndo
                      ? 'text-cyan-200 bg-cyan-950/40 border border-cyan-500/30'
                      : 'opacity-30 text-slate-500 border border-transparent'
                  }`}
                  title="元に戻す"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>

                {/* やり直す (Redo) */}
                <button
                  onClick={() => redo()}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    redo();
                  }}
                  disabled={!canRedo}
                  className={`p-1 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    canRedo
                      ? 'text-cyan-200 bg-cyan-950/40 border border-cyan-500/30'
                      : 'opacity-30 text-slate-500 border border-transparent'
                  }`}
                  title="やり直す"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />
            <button
              onClick={onToggleF3}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleF3();
              }}
              className={`px-1.5 py-1 rounded-lg text-[10px] font-mono transition-all active:scale-95 cursor-pointer ${
                isF3Open
                  ? 'bg-amber-500/30 text-amber-300'
                  : 'text-slate-400'
              }`}
            >
              F3
            </button>

            {/* 📱 モバイル用 時間・時間帯表示バッジ (タップで現実時刻に再同期) */}
            <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />
            <button
              onClick={() => {
                setIsRealtimeSync(true);
                syncToCurrentRealTime();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsRealtimeSync(true);
                syncToCurrentRealTime();
              }}
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-mono flex items-center gap-1 border transition-all active:scale-95 cursor-pointer ${periodInfo.bg} ${periodInfo.color}`}
              title="タップで現実の現在時刻に自動同期"
            >
              <span>{periodInfo.icon}</span>
              <span className="font-semibold">{formatTime(world.environment.time)}</span>
            </button>
          </div>

          {/* 右: マルチプレイヤー・ポータル・アバター (同一フレックス行で絶対に重ならない！) */}
          {multiplayerSlot && (
            <div className="flex items-center gap-1 shrink-0">
              {multiplayerSlot}
            </div>
          )}
        </div>
      </header>

      {/* 💻 PC・タブレット専用トップHUD (画面幅 >= 640px: 広々プレミアムレイアウト) */}
      <header
        className="hidden sm:flex absolute top-3 left-3 right-3 items-center justify-between pointer-events-none z-40 gap-2"
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* 左上: タイトル & モード切替 & Undo/Redo & F3 */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="glass-panel px-3.5 py-2 rounded-2xl flex items-center gap-3 bg-slate-950/80 backdrop-blur-md border border-white/15 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <h1 className="font-bold tracking-wider text-base bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
                Airas
              </h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                HD-2D
              </span>
            </div>

            <div className="w-[1px] h-4 bg-white/10" />

            {/* モード切替 (探索 / 編集) */}
            <div className="flex items-center p-0.5 bg-black/40 rounded-xl border border-white/5 shrink-0">
              <button
                onClick={(e) => {
                  (e.currentTarget as HTMLElement)?.blur();
                  setActiveMode('play');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  activeMode === 'play'
                    ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="探索モード (WASD移動・Spaceジャンプ・Ctrlダッシュ)"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>探索</span>
              </button>
              <button
                onClick={(e) => {
                  (e.currentTarget as HTMLElement)?.blur();
                  setActiveMode('edit');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  activeMode === 'edit'
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="編集モード (クリック選択・ドラッグ移動・パレット配置)"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>編集</span>
              </button>
            </div>

            {/* PC向け: 編集モード時のみ Undo/Redo & マス吸着を表示（探索モード時は隠して超スリム＆文字折り返し防止！） */}
            {activeMode === 'edit' && (
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-[1px] h-4 bg-white/10 mr-1 shrink-0" />
                <button
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement)?.blur();
                    undo();
                  }}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all shrink-0 ${
                    canUndo
                      ? 'glass-button text-slate-200 border-white/15 hover:text-white cursor-pointer'
                      : 'opacity-30 text-slate-500 border-transparent cursor-not-allowed'
                  }`}
                  title="元に戻す (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement)?.blur();
                    redo();
                  }}
                  disabled={!canRedo}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all shrink-0 ${
                    canRedo
                      ? 'glass-button text-slate-200 border-white/15 hover:text-white cursor-pointer'
                      : 'opacity-30 text-slate-500 border-transparent cursor-not-allowed'
                  }`}
                  title="やり直す (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>

                {/* 🧲 マス吸着トグル (編集時のみ表示・横文字コンパクト) */}
                <button
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement)?.blur();
                    toggleSnapToGrid();
                  }}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    isSnapToGrid
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400/40 shadow-sm'
                      : 'text-slate-400 hover:text-white border-transparent hover:bg-white/10'
                  }`}
                  title={isSnapToGrid ? 'マス吸着: ON (32pxグリッドにスナップ)' : 'マス吸着: OFF (ピクセル単位の自由配置)'}
                >
                  <span>🧲</span>
                  <span>{isSnapToGrid ? '吸着' : '自由'}</span>
                </button>
              </div>
            )}

            {/* F3 デバッグ画面トグル */}
            <button
              onClick={(e) => {
                (e.currentTarget as HTMLElement)?.blur();
                onToggleF3();
              }}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isF3Open
                  ? 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-white/10'
              }`}
              title="Minecraft風 F3 デバッグ情報 (F3キー)"
            >
              <Terminal className="w-3.5 h-3.5 shrink-0" />
              <span>F3</span>
            </button>
          </div>
        </div>

        {/* 中央: AI World Brain ボタン */}
        <div className="pointer-events-auto shrink-0">
          <button
            onClick={() => setAIPanelOpen(!isAIPanelOpen)}
            className={`px-4 py-2 rounded-2xl flex items-center gap-2 font-medium text-sm transition-all shadow-lg active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
              isAIPanelOpen
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/25 ring-2 ring-cyan-400'
                : 'glass-panel text-cyan-200 hover:text-white hover:border-cyan-400/50 hover:shadow-cyan-500/10 bg-slate-950/80 backdrop-blur-md'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>AI世界生成 & 画像創出</span>
            <span className="text-[10px] bg-cyan-900/80 px-1.5 py-0.5 rounded text-cyan-300 font-mono">
              ⌘K
            </span>
          </button>
        </div>

        {/* 右上: 時間・天候 & 設定 & カメラリセット & ヘルプ */}
        <div
          className="flex items-center gap-2 pointer-events-auto"
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* 天候セレクター */}
          <div className="glass-panel px-2.5 py-1.5 rounded-2xl items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-white/15 flex">
            <div className="flex items-center gap-1">
              {(['clear', 'sunset', 'rain', 'snow'] as WeatherType[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setWeather(w)}
                  className={`p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    world.environment.weather === w
                      ? 'bg-white/20 border border-white/30'
                      : 'opacity-50 hover:opacity-90'
                  }`}
                  title={weatherIcons[w].label}
                >
                  {weatherIcons[w].icon}
                </button>
              ))}
            </div>

            <div className="w-[1px] h-4 bg-white/10" />

            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
              {/* 🌅 時間帯バッジ */}
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 shadow-sm ${periodInfo.bg} ${periodInfo.color}`}
                title={`現在の時間帯: ${periodInfo.label}`}
              >
                <span>{periodInfo.icon}</span>
                <span>{periodInfo.label}</span>
              </span>

              <span className="font-semibold text-slate-200">{formatTime(world.environment.time)}</span>

              {/* 時刻スライダー (操作で手動モードに切替) */}
              <input
                type="range"
                min="0"
                max="24"
                step="0.25"
                value={world.environment.time}
                onChange={(e) => {
                  setIsRealtimeSync(false);
                  setTime(parseFloat(e.target.value));
                }}
                className="w-14 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                title="時刻調整（ドラッグで手動変更）"
              />

              {/* 🕒 現実時刻同期トグルボタン */}
              <button
                onClick={() => {
                  setIsRealtimeSync(true);
                  syncToCurrentRealTime();
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium transition-all active:scale-95 cursor-pointer border ${
                  isRealtimeSync
                    ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/50 shadow-sm'
                    : 'text-slate-400 bg-white/5 border-white/10 hover:text-white hover:bg-white/10'
                }`}
                title={isRealtimeSync ? '現在時刻と自動同期中（クリックで手動保持）' : 'クリックで現実の現在時刻に自動同期'}
              >
                {isRealtimeSync ? '● 現実連動' : '🕒 現実同期'}
              </button>
            </div>
          </div>

          {/* 🎵 Gemini AI BGMプレイヤー */}
          <div className="glass-panel px-2.5 py-1.5 rounded-2xl flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-white/15">
            <button
              onClick={onToggleBgm}
              className={`flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isBgmPlaying ? 'text-amber-300 hover:text-amber-200' : 'text-slate-400 hover:text-slate-300'
              }`}
              title={isBgmPlaying ? 'BGM一時停止' : 'BGM再生 (クリックでGemini AI生成曲を再生)'}
            >
              <Music className={`w-3.5 h-3.5 ${isBgmPlaying ? 'animate-bounce text-amber-400' : ''}`} />
              <span className="max-w-[120px] truncate text-[11px] font-medium">
                {currentBgmTitle || 'Gemini BGM'}
              </span>
            </button>
            <button
              onClick={onNextBgm}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95"
              title="次の曲へスキップ (全3曲)"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 設定・ツールボタン群 */}
          <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-white/15">
            {/* ⚡ 低負荷モード切り替え */}
            <button
              onClick={(e) => {
                (e.currentTarget as HTMLElement)?.blur();
                onTogglePerfMode?.();
              }}
              className={`p-1.5 rounded-xl transition-all cursor-pointer active:scale-95 ${
                isLowPerfMode
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
              title={isLowPerfMode ? '⚡ 低負荷モード稼働中' : '⚡ 低負荷モードに切替'}
            >
              <Zap className="w-4 h-4 text-amber-400" />
            </button>

            {/* サウンド ミュート / アンミュート */}
            <button
              onClick={() => toggleMute()}
              className={`p-1.5 rounded-xl transition-all active:scale-95 cursor-pointer ${
                isMuted
                  ? 'text-rose-400 bg-rose-500/20 hover:bg-rose-500/30'
                  : 'text-cyan-300 hover:text-white hover:bg-white/10'
              }`}
              title={isMuted ? 'サウンドをオンにする (Mキー)' : 'サウンドをミュートにする (Mキー)'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl hover:bg-white/10 text-amber-300 hover:text-white transition-all active:scale-95 cursor-pointer"
              title="Gemini API 設定"
            >
              <Key className="w-4 h-4" />
            </button>

            <button
              onClick={onResetCamera}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-mono active:scale-95 cursor-pointer"
              title="カメラリセット"
            >
              100%
            </button>

            <button
              onClick={onOpenHelp}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
              title="操作方法の確認"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
