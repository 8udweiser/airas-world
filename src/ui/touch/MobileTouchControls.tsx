import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUp, Car, Armchair, ChevronDown, Navigation } from 'lucide-react';
import { PixiWorldRenderer } from '../../renderer/pixi/PixiWorldRenderer';

interface MobileTouchControlsProps {
  renderer: PixiWorldRenderer | null;
  isDriving: boolean;
  isSitting: boolean;
  nearbyVehicleName?: string | null;
  nearbyBenchName?: string | null;
  onToggleVehicle: () => void;
  onToggleSit: () => void;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  renderer,
  isDriving,
  isSitting,
  nearbyVehicleName,
  nearbyBenchName,
  onToggleVehicle,
  onToggleSit,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // タッチデバイス判定 & ブラウザ操作系ジェスチャーの完全無効化
  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 1024;
      setIsTouchDevice(hasTouch);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);

    // 🚫 全ブラウザ共通 (Chrome, Brave, Firefox, Opera, Edge, Safari) のブラウザ操作系ジェスチャー完全無効化
    let lastTapTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      // 画面端からのスワイプ戻る/進むジェスチャー阻止 (Chrome, Edge, Safari, Brave等)
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.clientX < 35 || t.clientX > window.innerWidth - 35 || t.clientY < 30) {
          e.preventDefault();
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // 1. ピンチズーム阻止 (2本指以上は100%遮断)
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      // 2. プルダウン更新・画面スワイプナビゲーション阻止 (スクロール可能領域以外は完全抑止)
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.allow-scroll')) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      // ダブルタップズーム防止
      const now = performance.now();
      if (now - lastTapTime < 280) {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('input, textarea, .allow-scroll')) {
          e.preventDefault();
        }
      }
      lastTapTime = now;
    };

    const preventZoom = (e: Event) => {
      e.preventDefault();
    };

    const onFirstTouch = () => {
      setHasInteracted(true);
    };

    // wheel + ctrlKey (Ctrl+スクロールによるブラウザ拡大) 阻止
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchstart', onFirstTouch, { once: true });
    window.addEventListener('pointerdown', onFirstTouch, { once: true });
    window.addEventListener('gesturestart', preventZoom, { passive: false });
    window.addEventListener('gesturechange', preventZoom, { passive: false });
    window.addEventListener('gestureend', preventZoom, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', checkTouch);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchstart', onFirstTouch);
      window.removeEventListener('pointerdown', onFirstTouch);
      window.removeEventListener('gesturestart', preventZoom);
      window.removeEventListener('gesturechange', preventZoom);
      window.removeEventListener('gestureend', preventZoom);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ジャンプトリガー (Space)
  const triggerJump = useCallback(() => {
    if (!renderer) return;
    renderer.keys['Space'] = true;
    setTimeout(() => {
      if (renderer) renderer.keys['Space'] = false;
    }, 150);
  }, [renderer]);

  // スニーク（しゃがみ）トリガー (ShiftLeft)
  const setCrouch = useCallback(
    (crouching: boolean) => {
      if (!renderer) return;
      renderer.keys['ShiftLeft'] = crouching;
    },
    [renderer]
  );
  if (!isTouchDevice) {
    return null;
  }

  return (
    <div className="sm:hidden fixed inset-0 pointer-events-none z-30 select-none">
      {/* 🧭 初回ガイドヒント (操作開始でフェードアウト) */}
      {!hasInteracted && (
        <div className="absolute left-6 bottom-4 pointer-events-none animate-pulse">
          <div className="glass-panel px-3.5 py-1.5 rounded-xl border border-cyan-400/40 shadow-xl flex items-center gap-2 text-cyan-200 text-[11px] font-semibold backdrop-blur-md bg-slate-950/70">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>画面スワイプで歩き / 素早くダッシュ</span>
          </div>
        </div>
      )}

      {/* 🎮 画面右下: アクションボタングループ (親は pointer-events-auto) */}
      <div className="absolute right-4 bottom-8 pointer-events-auto flex flex-col items-end gap-2.5 touch-none z-40">
        {/* 🚗 車両 乗車 / 降車ボタン (短縮・直感表示) */}
        {(isDriving || nearbyVehicleName) && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleVehicle();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleVehicle();
            }}
            className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 font-black text-xs shadow-2xl active:scale-90 transition-all border cursor-pointer ${
              isDriving
                ? 'bg-gradient-to-r from-red-600 to-rose-700 border-red-300 text-white shadow-red-600/50 animate-pulse'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-200 text-white shadow-amber-500/50'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>{isDriving ? '降りる' : '乗る'}</span>
          </button>
        )}

        {/* 🛋️ ベンチ 座る / 立つボタン (短縮表示) */}
        {(isSitting || nearbyBenchName) && !isDriving && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSit();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSit();
            }}
            className="px-4 py-2.5 rounded-2xl flex items-center gap-2 font-black text-xs shadow-2xl active:scale-90 transition-all border bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-200 text-white shadow-emerald-500/50 cursor-pointer"
          >
            <Armchair className="w-4 h-4" />
            <span>{isSitting ? '立つ' : '座る'}</span>
          </button>
        )}

        {/* しゃがむ ＆ JUMP ボタン */}
        <div className="flex items-center gap-3">
          {/* 🏃 しゃがむ（スニーク）ボタン & ベンチ近接時は自動着席 */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (nearbyBenchName && !isSitting && !isDriving) {
                onToggleSit();
              } else {
                setCrouch(true);
              }
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCrouch(false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              if (nearbyBenchName && !isSitting && !isDriving) {
                onToggleSit();
              } else {
                setCrouch(true);
              }
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              setCrouch(false);
            }}
            className="w-16 h-16 rounded-2xl bg-slate-900/80 active:bg-purple-600 border border-purple-400/50 text-white shadow-xl flex flex-col items-center justify-center active:scale-90 transition-all cursor-pointer backdrop-blur-md"
          >
            <ChevronDown className="w-6 h-6 text-purple-300" />
            <span className="text-[10px] font-bold text-purple-200">しゃがむ</span>
          </button>

          {/* 🦘 ジャンプボタン (大型・ワンタップで爽快ジャンプ) */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerJump();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerJump();
            }}
            className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 active:from-cyan-400 active:to-blue-500 border-2 border-cyan-200 text-white shadow-2xl shadow-cyan-500/60 flex flex-col items-center justify-center active:scale-90 transition-transform cursor-pointer"
          >
            <ArrowUp className="w-8 h-8 drop-shadow-md stroke-[2.5]" />
            <span className="text-[11px] font-black tracking-widest drop-shadow-md">JUMP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
