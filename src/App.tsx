import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWorldStore } from './store/useWorldStore';
import { useUIStore } from './store/useUIStore';
import { PixiWorldRenderer } from './renderer/pixi/PixiWorldRenderer';
import { TopHUD } from './ui/hud/TopHUD';
import { ObjectContextMenu } from './ui/context/ObjectContextMenu';
import { AIPanelModal } from './ui/ai-panel/AIPanelModal';
import { AssetPaletteBar } from './ui/editor/AssetPaletteBar';
import { DialogueModal } from './ui/components/DialogueModal';
import { HelpModal } from './ui/components/HelpModal';
import { RendererGhostEntity } from './renderer/IRenderer';
import { Bell } from 'lucide-react';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);

  const { world, assets, createObject, moveObject, undo, redo, updatePlayerPosition } = useWorldStore();
  const {
    selectedEntityId,
    setSelectedEntityId,
    activeMode,
    activeTool,
    placingAssetId,
    setPlacingAssetId,
    isAIPanelOpen,
    setAIPanelOpen,
    notification,
    showNotification,
  } = useUIStore();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [ghostEntities, setGhostEntities] = useState<RendererGhostEntity[]>([]);

  // キーボード移動状態
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // レンダラー初期化
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const renderer = new PixiWorldRenderer();
    rendererRef.current = renderer;

    renderer.init(canvasContainerRef.current).then(() => {
      // オブジェクトクリック
      renderer.onEntityClick = (entityId: string) => {
        setSelectedEntityId(entityId);
      };

      // マップクリック
      renderer.onMapClick = (worldX: number, worldY: number) => {
        const currentPlacing = useUIStore.getState().placingAssetId;
        if (currentPlacing) {
          const newId = createObject(currentPlacing, worldX, worldY);
          if (newId) {
            setSelectedEntityId(newId);
            showNotification('オブジェクトを配置しました');
          }
        } else {
          setSelectedEntityId(null);
        }
      };

      // オブジェクトドラッグ移動
      renderer.onEntityDrag = (entityId: string, newX: number, newY: number) => {
        moveObject(entityId, newX, newY);
      };
    });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // ゲームループ & レンダリングループ
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // 探索モード時のプレイヤー移動処理
      const currentMode = useUIStore.getState().activeMode;
      if (currentMode === 'play') {
        const speed = world.player.speed;
        let dx = 0;
        let dy = 0;

        if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) dy -= 1;
        if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) dy += 1;
        if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) dx -= 1;
        if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) dx += 1;

        if (dx !== 0 || dy !== 0) {
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = (dx / len) * speed * dt;
          const ny = (dy / len) * speed * dt;

          let dir: 'down' | 'up' | 'left' | 'right' = world.player.direction;
          if (Math.abs(dx) > Math.abs(dy)) {
            dir = dx > 0 ? 'right' : 'left';
          } else {
            dir = dy > 0 ? 'down' : 'up';
          }

          const newX = Math.round(world.player.position.x + nx);
          const newY = Math.round(world.player.position.y + ny);
          updatePlayerPosition(newX, newY, dir, true);
        } else if (world.player.isMoving) {
          updatePlayerPosition(world.player.position.x, world.player.position.y, world.player.direction, false);
        }
      }

      // レンダリング実行
      if (rendererRef.current) {
        rendererRef.current.render(world, assets, selectedEntityId, ghostEntities);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [world, assets, selectedEntityId, ghostEntities]);

  // キーボードイベント (WASD & ショートカット)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力要素にフォーカスがある場合は無視
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      keysPressed.current[e.code] = true;

      // Undo: Ctrl+Z / ⌘+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y / ⌘+Y または Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // AIパネル: Ctrl+K / ⌘+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAIPanelOpen(!isAIPanelOpen);
        return;
      }

      // 選択解除: Escape
      if (e.key === 'Escape') {
        setSelectedEntityId(null);
        setPlacingAssetId(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, isAIPanelOpen]);

  const handleResetCamera = useCallback(() => {
    rendererRef.current?.resetCamera();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0f19] select-none">
      {/* 2.5D Pixi レンダリングコンテナ */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* トップHUD */}
      <TopHUD onResetCamera={handleResetCamera} onOpenHelp={() => setIsHelpOpen(true)} />

      {/* コンテキストUI (オブジェクト選択時) */}
      <ObjectContextMenu />

      {/* アセット配置バー */}
      <AssetPaletteBar />

      {/* AIワールド生成パネル */}
      <AIPanelModal onSetGhostPreview={setGhostEntities} />

      {/* ダイアログモーダル */}
      <DialogueModal />

      {/* 操作ヘルプモーダル */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* 通知トースト */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl glass-panel border border-cyan-400/40 text-cyan-200 text-xs font-medium flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <Bell className="w-3.5 h-3.5 text-cyan-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* 探索モード時の操作ヒント */}
      {activeMode === 'play' && (
        <div className="absolute bottom-4 left-4 z-20 glass-panel px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-slate-300 pointer-events-none flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>WASD / 矢印キーでプレイヤーを歩行移動できます</span>
        </div>
      )}
    </div>
  );
};
