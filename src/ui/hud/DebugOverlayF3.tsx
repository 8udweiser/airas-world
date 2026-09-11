import React, { useState, useEffect } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';

interface DebugOverlayF3Props {
  isOpen: boolean;
  fps?: number;
}

export const DebugOverlayF3: React.FC<DebugOverlayF3Props> = ({ isOpen }) => {
  if (!isOpen) return null;

  const [liveInfo, setLiveInfo] = useState(() => {
    const world = useWorldStore.getState().world;
    return {
      x: world.player.position.x,
      y: world.player.position.y,
      z: world.player.position.z,
      direction: world.player.direction,
      isMoving: false,
      isSprinting: false,
      isSneaking: false,
      isJumping: false,
      isSitting: false,
      isDriving: false,
      fps: 60,
    };
  });

  // 🚀 リアルタイム座標 & 物理ステート追従 (F3表示中のみ 30FPSでRendererから直接取得)
  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;

    const update = (now: number) => {
      // 30FPS相当 (約33ms間隔) で更新し、CPU負荷を最小限に抑制
      if (now - lastUpdate >= 33) {
        lastUpdate = now;
        const renderer = (window as any).__renderer;
        if (renderer?.playerState) {
          const ps = renderer.playerState;
          const currentFps = (renderer as any).lastFps || useUIStore.getState().fps || 60;
          setLiveInfo({
            x: ps.x,
            y: ps.y,
            z: ps.z,
            direction: ps.direction,
            isMoving: Boolean(ps.isMoving),
            isSprinting: Boolean(ps.isSprinting),
            isSneaking: Boolean(ps.isSneaking),
            isJumping: Boolean(ps.isJumping),
            isSitting: Boolean(ps.isSitting),
            isDriving: Boolean(ps.isDriving),
            fps: currentFps,
          });
        }
      }
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  const world = useWorldStore.getState().world;
  const cx = Math.floor(liveInfo.x / (world.map.chunkSize * world.map.tileSize));
  const cy = Math.floor(liveInfo.y / (world.map.chunkSize * world.map.tileSize));
  const entityCount = Object.keys(world.entities).length + 1;

  const formatDirection = (dir: string) => {
    switch (dir) {
      case 'up':
        return 'north (towards -Y)';
      case 'down':
        return 'south (towards +Y)';
      case 'left':
        return 'west (towards -X)';
      case 'right':
        return 'east (towards +X)';
      default:
        return dir;
    }
  };

  return (
    <div className="absolute top-24 sm:top-14 left-2 sm:left-3 z-40 p-2 sm:p-2.5 max-w-[88vw] sm:max-w-[280px] bg-slate-950/60 sm:bg-slate-950/75 text-[#f8fafc] font-mono text-[10px] sm:text-[11px] rounded-xl border border-white/15 shadow-2xl backdrop-blur-md pointer-events-none space-y-0.5">
      <div className="text-amber-300 font-bold tracking-wider text-[10px] sm:text-xs flex items-center justify-between">
        <span>Airas 0.2.0 (HD-2D)</span>
        <span className="text-emerald-400 font-bold">{Math.round(liveInfo.fps)} FPS</span>
      </div>
      <div>
        XYZ: <span className="text-cyan-300 font-bold">{liveInfo.x.toFixed(1)}</span> /{' '}
        <span className="text-cyan-300 font-bold">{liveInfo.y.toFixed(1)}</span> /{' '}
        <span className="text-cyan-300 font-bold">{liveInfo.z.toFixed(1)}</span>
      </div>
      <div>
        Chunk: {cx}, {cy}
      </div>
      <div>Facing: {formatDirection(liveInfo.direction)}</div>
      <div>
        State:{' '}
        {liveInfo.isDriving
          ? '🚗 運転中'
          : liveInfo.isSitting
          ? '🛋️ 着席中'
          : liveInfo.isJumping
          ? 'ジャンプ'
          : liveInfo.isSprinting
          ? 'ダッシュ'
          : liveInfo.isSneaking
          ? 'しゃがみ'
          : liveInfo.isMoving
          ? '歩行'
          : '待機'}
      </div>
      <div>Entities: {entityCount} active</div>
      <div>
        Env: {world.environment.weather}, {world.environment.time.toFixed(1)}h
      </div>
    </div>
  );
};
