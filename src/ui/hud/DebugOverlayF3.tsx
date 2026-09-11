import React, { useState, useEffect } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';

interface DebugOverlayF3Props {
  isOpen: boolean;
  fps?: number;
}

export const DebugOverlayF3: React.FC<DebugOverlayF3Props> = ({ isOpen }) => {
  const { world } = useWorldStore();
  const fps = useUIStore((s) => s.fps);

  const [livePlayer, setLivePlayer] = useState({
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
  });

  // 🚀 リアルタイム座標 & 物理ステート追従 (毎フレーム Renderer から直接取得)
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;
    let lastUpdate = 0;

    const update = (now: number) => {
      // 30FPS相当 (約33ms間隔) でReact stateを更新し、CPU負荷を最小化しながら滑らかに追従
      if (now - lastUpdate >= 30) {
        lastUpdate = now;
        const renderer = (window as any).__renderer;
        if (renderer?.playerState) {
          const ps = renderer.playerState;
          setLivePlayer({
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
          });
        }
      }
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) return null;

  const cx = Math.floor(livePlayer.x / (world.map.chunkSize * world.map.tileSize));
  const cy = Math.floor(livePlayer.y / (world.map.chunkSize * world.map.tileSize));
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
    <div className="absolute top-24 sm:top-16 left-2 sm:left-4 z-40 p-2.5 sm:p-3 max-w-[90vw] sm:max-w-none bg-slate-950/50 sm:bg-black/75 text-[#f8fafc] font-mono text-[10px] sm:text-xs rounded-xl border border-white/15 sm:border-white/20 shadow-2xl backdrop-blur-sm sm:backdrop-blur-md pointer-events-none space-y-0.5 sm:space-y-1">
      <div className="text-amber-300 font-bold tracking-wider text-[11px] sm:text-xs">
        Airas 0.2.0 (HD-2D Engine)
      </div>
      <div>
        FPS: <span className="text-emerald-400 font-bold">{Math.round(fps)}</span>
      </div>
      <div>
        XYZ: <span className="text-cyan-300 font-bold">{livePlayer.x.toFixed(1)}</span> /{' '}
        <span className="text-cyan-300 font-bold">{livePlayer.y.toFixed(1)}</span> /{' '}
        <span className="text-cyan-300 font-bold">{livePlayer.z.toFixed(1)}</span>
      </div>
      <div>
        Chunk: {cx}, {cy} (Map: {world.map.tileSize * world.map.chunkSize * 3}x{world.map.tileSize * world.map.chunkSize * 2}px)
      </div>
      <div>Facing: {formatDirection(livePlayer.direction)}</div>
      <div>
        State: {livePlayer.isDriving ? '🚗 Driving ' : ''}
        {livePlayer.isSitting ? '🛋️ Sitting ' : ''}
        {livePlayer.isJumping ? 'Jumping ' : ''}
        {livePlayer.isSprinting ? 'Sprinting (Dash) ' : ''}
        {livePlayer.isSneaking ? 'Sneaking (Crouch) ' : ''}
        {!livePlayer.isMoving && !livePlayer.isJumping && !livePlayer.isDriving && !livePlayer.isSitting ? 'Standing' : ''}
        {livePlayer.isMoving && !livePlayer.isDriving ? 'Walking' : ''}
      </div>
      <div>Entities: {entityCount} active</div>
      <div>
        Environment: {world.environment.weather}, {world.environment.time.toFixed(1)}h
      </div>
      <div className="hidden sm:block text-[10px] text-slate-400 pt-1 border-t border-white/10">
        Keybinds: W/A/S/D=Move, Space=Jump, Ctrl=Sprint, Shift=Sneak, E=Palette, RightClick=Interact, F3=Toggle
      </div>
    </div>
  );
};
