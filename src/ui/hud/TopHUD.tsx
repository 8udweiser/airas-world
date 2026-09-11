import React from 'react';
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
}) => {
  const { world, canUndo, canRedo, undo, redo, setWeather, setTime } = useWorldStore();
  const { isAIPanelOpen, setAIPanelOpen, activeMode, setActiveMode, isMuted, toggleMute } = useUIStore();

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

  return (
    <header className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-30">
      {/* 左上: タイトル & モード切替 & Undo/Redo & F3 */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="glass-panel px-3.5 py-2 rounded-2xl flex items-center gap-3">
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

          {/* モード切替 */}
          <div className="flex items-center p-0.5 bg-black/40 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveMode('play')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                activeMode === 'play'
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="探索モード (WASD移動・Spaceジャンプ・Ctrlダッシュ)"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>探索</span>
            </button>
            <button
              onClick={() => setActiveMode('edit')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                activeMode === 'edit'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="編集モード (クリック選択・ドラッグ移動・パレット配置)"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>編集</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-white/10" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                canUndo
                  ? 'glass-button text-slate-200 border-white/15 hover:text-white cursor-pointer'
                  : 'opacity-30 text-slate-500 border-transparent cursor-not-allowed'
              }`}
              title="元に戻す (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                canRedo
                  ? 'glass-button text-slate-200 border-white/15 hover:text-white cursor-pointer'
                  : 'opacity-30 text-slate-500 border-transparent cursor-not-allowed'
              }`}
              title="やり直す (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-[1px] h-4 bg-white/10" />

          {/* F3 デバッグ画面トグル */}
          <button
            onClick={onToggleF3}
            className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 transition-all ${
              isF3Open
                ? 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                : 'text-slate-400 hover:text-white border-transparent hover:bg-white/10'
            }`}
            title="Minecraft風 F3 デバッグ情報 (F3キー)"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>F3</span>
          </button>
        </div>
      </div>

      {/* 中央: AI World Brain ボタン */}
      <div className="pointer-events-auto">
        <button
          onClick={() => setAIPanelOpen(!isAIPanelOpen)}
          className={`px-4 py-2 rounded-2xl flex items-center gap-2 font-medium text-sm transition-all shadow-lg ${
            isAIPanelOpen
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/25 ring-2 ring-cyan-400'
              : 'glass-panel text-cyan-200 hover:text-white hover:border-cyan-400/50 hover:shadow-cyan-500/10'
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
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="glass-panel px-3 py-1.5 rounded-2xl flex items-center gap-3">
          <div className="flex items-center gap-1">
            {(['clear', 'sunset', 'rain', 'snow'] as WeatherType[]).map((w) => (
              <button
                key={w}
                onClick={() => setWeather(w)}
                className={`p-1.5 rounded-lg transition-all ${
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

          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span>{formatTime(world.environment.time)}</span>
            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={world.environment.time}
              onChange={(e) => setTime(parseFloat(e.target.value))}
              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              title="時刻調整"
            />
          </div>
        </div>

        {/* 🎵 Gemini AI BGMプレイヤー */}
        <div className="glass-panel px-2.5 py-1.5 rounded-2xl flex items-center gap-2">
          <button
            onClick={onToggleBgm}
            className={`flex items-center gap-1.5 transition-all cursor-pointer ${
              isBgmPlaying ? 'text-amber-300 hover:text-amber-200' : 'text-slate-400 hover:text-slate-300'
            }`}
            title={isBgmPlaying ? 'BGM一時停止' : 'BGM再生 (クリックでGemini AI生成曲を再生)'}
          >
            <Music className={`w-3.5 h-3.5 ${isBgmPlaying ? 'animate-bounce text-amber-400' : ''}`} />
            <span className="max-w-[120px] truncate text-[11px] font-medium hidden sm:inline">
              {currentBgmTitle || 'Gemini BGM'}
            </span>
          </button>
          <button
            onClick={onNextBgm}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="次の曲へスキップ (全3曲)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-1">
          {/* ⚡ 低負荷モード切り替え (低スペックPC用) */}
          <button
            onClick={onTogglePerfMode}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              isLowPerfMode
                ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
            title={isLowPerfMode ? '⚡ 低負荷モード稼働中 (クリックで通常画質)' : '⚡ 低負荷・軽量モードに切替 (重いブラー無効化・GPU負荷激減)'}
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* サウンド ミュート / アンミュート */}
          <button
            onClick={() => toggleMute()}
            className={`p-1.5 rounded-xl transition-all ${
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
            className="p-1.5 rounded-xl hover:bg-white/10 text-amber-300 hover:text-white transition-all"
            title="Gemini API 設定"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={onResetCamera}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-mono"
            title="カメラリセット"
          >
            100%
          </button>
          <button
            onClick={onOpenHelp}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all"
            title="操作方法の確認"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
