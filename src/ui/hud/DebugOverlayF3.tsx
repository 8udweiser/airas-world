import React from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';

interface DebugOverlayF3Props {
  isOpen: boolean;
  fps?: number;
}

export const DebugOverlayF3: React.FC<DebugOverlayF3Props> = ({ isOpen }) => {
  const { world } = useWorldStore();
  const fps = useUIStore((s) => s.fps);
  if (!isOpen) return null;

  const player = world.player;
  const cx = Math.floor(player.position.x / (world.map.chunkSize * world.map.tileSize));
  const cy = Math.floor(player.position.y / (world.map.chunkSize * world.map.tileSize));
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
    <div className="absolute top-16 left-4 z-40 p-3 bg-black/75 text-[#f8fafc] font-mono text-xs rounded-xl border border-white/20 shadow-2xl backdrop-blur-md pointer-events-none space-y-1">
      <div className="text-amber-300 font-bold tracking-wider">Airas 0.2.0 (HD-2D World Engine)</div>
      <div>FPS: <span className="text-emerald-400 font-bold">{Math.round(fps)}</span></div>
      <div>
        XYZ: <span className="text-cyan-300 font-bold">{player.position.x.toFixed(1)}</span> /{' '}
        <span className="text-cyan-300 font-bold">{player.position.y.toFixed(1)}</span> /{' '}
        <span className="text-cyan-300 font-bold">{player.position.z.toFixed(1)}</span>
      </div>
      <div>
        Chunk: {cx}, {cy} (Map: {world.map.tileSize * world.map.chunkSize * 3}x{world.map.tileSize * world.map.chunkSize * 2}px)
      </div>
      <div>Facing: {formatDirection(player.direction)}</div>
      <div>
        State: {player.isJumping ? 'Jumping ' : ''}
        {player.isSprinting ? 'Sprinting (Dash) ' : ''}
        {player.isSneaking ? 'Sneaking (Crouch) ' : ''}
        {!player.isMoving && !player.isJumping ? 'Standing' : 'Walking'}
      </div>
      <div>Entities: {entityCount} active</div>
      <div>Environment: Weather={world.environment.weather}, Time={world.environment.time.toFixed(1)}h</div>
      <div className="text-[10px] text-slate-400 pt-1 border-t border-white/10">
        Keybinds: W/A/S/D=Move, Space=Jump, Ctrl=Sprint, Shift=Sneak, E=Palette, RightClick=Interact, F3=Toggle
      </div>
    </div>
  );
};
