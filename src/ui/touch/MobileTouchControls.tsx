import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, Car, Armchair, ChevronDown, Zap, Navigation } from 'lucide-react';
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
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickOrigin, setJoystickOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDashing, setIsDashing] = useState(false);
  const [activeDirectionLabel, setActiveDirectionLabel] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState(false);

  // タッチ追跡用のRef
  const touchIdRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDashLockedRef = useRef<boolean>(false);

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

    // 🚫 スマホのブラウザ操作系ジェスチャー (戻る/進むスワイプ・ピンチズーム・引っ張り更新) 完全無効化
    const preventBrowserGestures = (e: TouchEvent) => {
      // 画面左右端からの「戻る/進む」エッジスワイプを防止
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.clientX < 25 || t.clientX > window.innerWidth - 25) {
          e.preventDefault();
        }
      }
    };

    const preventZoom = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('touchstart', preventBrowserGestures, { passive: false });
    window.addEventListener('gesturestart', preventZoom, { passive: false });
    window.addEventListener('gesturechange', preventZoom, { passive: false });

    return () => {
      window.removeEventListener('resize', checkTouch);
      window.removeEventListener('touchstart', preventBrowserGestures);
      window.removeEventListener('gesturestart', preventZoom);
      window.removeEventListener('gesturechange', preventZoom);
    };
  }, []);

  // キー入力更新
  const updateKey = useCallback(
    (code: string, pressed: boolean) => {
      if (!renderer) return;
      renderer.keys[code] = pressed;
    },
    [renderer]
  );

  // 全方向キー・ダッシュの解除
  const clearDirectionKeys = useCallback(() => {
    if (!renderer) return;
    renderer.keys['KeyW'] = false;
    renderer.keys['KeyS'] = false;
    renderer.keys['KeyA'] = false;
    renderer.keys['KeyD'] = false;
    renderer.keys['ControlLeft'] = false;
    setIsDashing(false);
    isDashLockedRef.current = false;
    setActiveDirectionLabel('');
  }, [renderer]);

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

  // 🎯 タッチ開始 (左側65%の操作領域で発火)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHasInteracted(true);

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touchIdRef.current === null) {
        touchIdRef.current = touch.identifier;
        touchStartTimeRef.current = performance.now();
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        isDashLockedRef.current = false;

        setJoystickOrigin({ x: touch.clientX, y: touch.clientY });
        setKnobPos({ x: touch.clientX, y: touch.clientY });
        setJoystickActive(true);
        setIsDashing(false);
        break;
      }
    }
  };

  // 🎯 スワイプ移動・ダッシュ判定
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        const ox = joystickOrigin.x;
        const oy = joystickOrigin.y;
        const dx = touch.clientX - ox;
        const dy = touch.clientY - oy;
        const dist = Math.hypot(dx, dy);

        // ジョイスティックノブの可動半径クランプ (最大 56px)
        const maxRadius = 56;
        const angle = Math.atan2(dy, dx);
        const clampedDist = Math.min(dist, maxRadius);

        setKnobPos({
          x: ox + Math.cos(angle) * clampedDist,
          y: oy + Math.sin(angle) * clampedDist,
        });

        // デッドゾーン (7px) 未満は停止
        if (dist < 7) {
          clearDirectionKeys();
          return;
        }

        // 🏃💨 スワイプ速度 (px/ms) と指の移動距離による動的ダッシュ / 歩行判定
        // 「上にスワイプで歩き、素早くスワイプでダッシュ、ゆっくりで歩行に戻る」スムーズ操作
        const now = performance.now();
        const elapsed = Math.max(1, now - touchStartTimeRef.current);
        const velocity = dist / elapsed; // 移動速度 px / ms

        // 素早いフリック (velocity > 0.20) または 大きめのスワイプ (dist >= 28px) でダッシュ発動
        const isDashingNow = velocity > 0.20 || dist >= 28;

        setIsDashing(isDashingNow);
        updateKey('ControlLeft', isDashingNow);

        // 🧭 8方向スムーズ角度判定 (-180° 〜 180°)
        const deg = (angle * 180) / Math.PI;

        const isRight = deg >= -67.5 && deg <= 67.5;
        const isLeft = deg >= 112.5 || deg <= -112.5;
        const isDown = deg >= 22.5 && deg <= 157.5;
        const isUp = deg <= -22.5 && deg >= -157.5;

        updateKey('KeyD', isRight);
        updateKey('KeyA', isLeft);
        updateKey('KeyS', isDown);
        updateKey('KeyW', isUp);

        // デバッグ・UI用方向ラベル
        let dirLabel = '';
        if (isUp && isRight) dirLabel = '右上 ↗';
        else if (isUp && isLeft) dirLabel = '左上 ↖';
        else if (isDown && isRight) dirLabel = '右下 ↘';
        else if (isDown && isLeft) dirLabel = '左下 ↙';
        else if (isUp) dirLabel = '前進 ⬆';
        else if (isDown) dirLabel = '後退 ⬇';
        else if (isRight) dirLabel = '右 ➡';
        else if (isLeft) dirLabel = '左 ⬅';
        setActiveDirectionLabel(dirLabel);

        break;
      }
    }
  };

  // 🎯 タッチ終了
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setJoystickActive(false);
        clearDirectionKeys();
        break;
      }
    }
  };

  if (!isTouchDevice) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-10 select-none touch-none">
      {/* 📱 画面左側スワイプ受容エリア (上部HUDと左下チャットボタンを避けた安全領域) */}
      <div
        className="absolute left-0 top-20 bottom-24 w-[60%] pointer-events-auto touch-none z-10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* 初回ガイドヒント (操作開始でフェードアウト) */}
        {!hasInteracted && (
          <div className="absolute left-6 bottom-4 pointer-events-none animate-pulse">
            <div className="glass-panel px-3.5 py-1.5 rounded-xl border border-cyan-400/40 shadow-xl flex items-center gap-2 text-cyan-200 text-[11px] font-semibold backdrop-blur-md bg-slate-950/70">
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              <span>スワイプで歩き / 素早くダッシュ</span>
            </div>
          </div>
        )}
      </div>

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
          {/* 🏃 しゃがむ（スニーク）ボタン */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCrouch(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCrouch(false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setCrouch(true);
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
