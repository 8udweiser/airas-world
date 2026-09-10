import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, Car, Armchair, ChevronDown, Zap } from 'lucide-react';
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

  const joystickTouchIdRef = useRef<number | null>(null);

  // タッチデバイス判定 (coarse pointer または 1024px 以下のモバイル/タブレット画面)
  useEffect(() => {
    const checkTouch = () => {
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth <= 1024;
      const hasTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && (isCoarse || isSmallScreen);
      setIsTouchDevice(hasTouch);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // キー入力を安全に更新
  const updateKey = useCallback(
    (code: string, pressed: boolean) => {
      if (!renderer) return;
      renderer.keys[code] = pressed;
    },
    [renderer]
  );

  // 全方向キー解除
  const clearDirectionKeys = useCallback(() => {
    if (!renderer) return;
    renderer.keys['KeyW'] = false;
    renderer.keys['KeyS'] = false;
    renderer.keys['KeyA'] = false;
    renderer.keys['KeyD'] = false;
    renderer.keys['ControlLeft'] = false;
    setIsDashing(false);
  }, [renderer]);

  // ジャンプトリガー
  const triggerJump = useCallback(() => {
    if (!renderer) return;
    renderer.keys['Space'] = true;
    setTimeout(() => {
      if (renderer) renderer.keys['Space'] = false;
    }, 120);
  }, [renderer]);

  // スニーク（しゃがみ）トリガー
  const setCrouch = useCallback(
    (crouching: boolean) => {
      if (!renderer) return;
      renderer.keys['ShiftLeft'] = crouching;
    },
    [renderer]
  );

  // マルチタッチ対応のタッチ開始ハンドラ
  const handleTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // 画面左側（55%以内）のタッチをバーチャルジョイスティックにバインド
      if (touch.clientX < window.innerWidth * 0.55 && joystickTouchIdRef.current === null) {
        joystickTouchIdRef.current = touch.identifier;
        setJoystickOrigin({ x: touch.clientX, y: touch.clientY });
        setKnobPos({ x: touch.clientX, y: touch.clientY });
        setJoystickActive(true);
      }
    }
  };

  // タッチ移動ハンドラ (スライド距離に応じた歩行 / ダッシュ判定)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (joystickTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        const dx = touch.clientX - joystickOrigin.x;
        const dy = touch.clientY - joystickOrigin.y;
        const dist = Math.hypot(dx, dy);

        // ノブの最大可動半径 (50px)
        const maxRadius = 50;
        const angle = Math.atan2(dy, dx);
        const clampedDist = Math.min(dist, maxRadius);

        setKnobPos({
          x: joystickOrigin.x + Math.cos(angle) * clampedDist,
          y: joystickOrigin.y + Math.sin(angle) * clampedDist,
        });

        // デッドゾーン (8px) を超えたら方向判定
        if (dist > 8) {
          // 40px以上スライドで「ダッシュ / ニトロ加速」
          const dash = dist >= 36;
          setIsDashing(dash);
          updateKey('ControlLeft', dash);

          // 角度に基づく8方向入力判定
          const deg = (angle * 180) / Math.PI;
          updateKey('KeyD', deg >= -67.5 && deg <= 67.5);
          updateKey('KeyA', deg >= 112.5 || deg <= -112.5);
          updateKey('KeyS', deg >= 22.5 && deg <= 157.5);
          updateKey('KeyW', deg <= -22.5 && deg >= -157.5);
        } else {
          clearDirectionKeys();
        }
      }
    }
  };

  // タッチ終了・キャンセルハンドラ
  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setJoystickActive(false);
        clearDirectionKeys();
      }
    }
  };

  if (!isTouchDevice) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 select-none touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* バーチャルジョイスティック (左手操作域) */}
      {joystickActive && (
        <div
          className="absolute rounded-full border border-white/20 bg-black/30 backdrop-blur-sm pointer-events-none transition-opacity duration-150"
          style={{
            left: joystickOrigin.x - 55,
            top: joystickOrigin.y - 55,
            width: 110,
            height: 110,
          }}
        >
          {/* ジョイスティック外周リング */}
          <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-pulse" />

          {/* ジョイスティックつまみ (Knob) */}
          <div
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg transition-all duration-75 flex items-center justify-center ${
              isDashing
                ? 'w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-300 shadow-amber-500/50'
                : 'w-11 h-11 bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-cyan-300 shadow-cyan-500/50'
            }`}
            style={{
              left: knobPos.x - joystickOrigin.x + 55,
              top: knobPos.y - joystickOrigin.y + 55,
            }}
          >
            {isDashing ? (
              <Zap className="w-5 h-5 text-white animate-pulse" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full bg-white/80" />
            )}
          </div>
        </div>
      )}

      {/* 画面右下: アクションボタングループ */}
      <div className="absolute right-4 bottom-8 pointer-events-auto flex flex-col items-end gap-3">
        {/* 🚗 乗車・降車ボタン (周囲にある時または運転中) */}
        {(isDriving || nearbyVehicleName) && (
          <button
            onClick={onToggleVehicle}
            className={`px-4 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm shadow-xl active:scale-95 transition-all border ${
              isDriving
                ? 'bg-red-500/80 hover:bg-red-600 border-red-300 text-white shadow-red-500/40'
                : 'bg-amber-500/80 hover:bg-amber-600 border-amber-300 text-white shadow-amber-500/40'
            }`}
          >
            <Car className="w-5 h-5" />
            <span>{isDriving ? '降車' : '乗る'}</span>
          </button>
        )}

        {/* 🛋️ ベンチ着席・立ち上がりボタン */}
        {(isSitting || nearbyBenchName) && !isDriving && (
          <button
            onClick={onToggleSit}
            className="px-4 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm shadow-xl active:scale-95 transition-all border bg-emerald-500/80 hover:bg-emerald-600 border-emerald-300 text-white shadow-emerald-500/40"
          >
            <Armchair className="w-5 h-5" />
            <span>{isSitting ? '立つ' : '座る'}</span>
          </button>
        )}

        <div className="flex items-center gap-3">
          {/* 🏃 しゃがみボタン */}
          <button
            onTouchStart={() => setCrouch(true)}
            onTouchEnd={() => setCrouch(false)}
            onMouseDown={() => setCrouch(true)}
            onMouseUp={() => setCrouch(false)}
            className="w-14 h-14 rounded-2xl bg-purple-600/70 active:bg-purple-500 border border-purple-300/60 text-white shadow-lg flex flex-col items-center justify-center active:scale-90 transition-transform"
          >
            <ChevronDown className="w-6 h-6" />
            <span className="text-[10px] font-bold">しゃがむ</span>
          </button>

          {/* 🦘 ジャンプボタン（大型・2本指で押しやすい） */}
          <button
            onClick={triggerJump}
            onTouchStart={(e) => {
              e.preventDefault();
              triggerJump();
            }}
            className="w-18 h-18 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 active:from-cyan-400 active:to-blue-500 border-2 border-cyan-200/80 text-white shadow-2xl shadow-cyan-500/50 flex flex-col items-center justify-center active:scale-90 transition-transform cursor-pointer"
          >
            <ArrowUp className="w-8 h-8 drop-shadow" />
            <span className="text-[11px] font-extrabold tracking-wider drop-shadow">JUMP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
