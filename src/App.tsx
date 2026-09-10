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
import { SettingsModal } from './ui/components/SettingsModal';
import { DebugOverlayF3 } from './ui/hud/DebugOverlayF3';
import { RendererGhostEntity } from './renderer/IRenderer';
import { Bell } from 'lucide-react';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);

  const { world, assets, createObject, moveObject, undo, redo, updatePlayerState } = useWorldStore();
  const {
    selectedEntityId,
    setSelectedEntityId,
    activeMode,
    placingAssetId,
    setPlacingAssetId,
    isAIPanelOpen,
    setAIPanelOpen,
    setDialogue,
    notification,
    showNotification,
  } = useUIStore();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isF3Open, setIsF3Open] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [fps, setFps] = useState(60);
  const [ghostEntities, setGhostEntities] = useState<RendererGhostEntity[]>([]);

  // 移動・アクション用キー管理
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // プレイヤーのジャンプ物理ステート
  const playerPhysics = useRef({
    z: 0,
    vz: 0,
    isJumping: false,
  });

  // レンダラー初期化
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const renderer = new PixiWorldRenderer();
    rendererRef.current = renderer;

    renderer.init(canvasContainerRef.current).then(() => {
      // 左クリック (選択)
      renderer.onEntityClick = (entityId: string) => {
        setSelectedEntityId(entityId);
      };

      // 右クリック (Minecraft風 オブジェクト使用/インタラクション)
      renderer.onEntityRightClick = (entityId: string) => {
        const ent = useWorldStore.getState().world.entities[entityId];
        if (!ent) return;
        const asset = useWorldStore.getState().assets[ent.assetId];
        if (!asset) return;

        if (asset.interactions && asset.interactions.length > 0) {
          const act = asset.interactions[0];
          if (act.dialogue && act.dialogue.length > 0) {
            setDialogue({
              title: `${ent.name}`,
              lines: act.dialogue,
            });
          } else {
            showNotification(`${ent.name}: ${act.label}`);
          }
        } else {
          setSelectedEntityId(entityId);
        }
      };

      // マップクリック (配置または選択解除)
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

  // ゲームループ & プレイヤー物理演算 (60fps)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;

    const loop = (currentTime: number) => {
      const dt = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // FPS計測
      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        setFps((frameCount / fpsTimer));
        frameCount = 0;
        fpsTimer = 0;
      }

      // --- プレイヤー移動 & マイクラ操作処理 ---
      const keys = keysPressed.current;
      const isUp = keys['KeyW'] || keys['ArrowUp'] || keys['w'] || keys['W'];
      const isDown = keys['KeyS'] || keys['ArrowDown'] || keys['s'] || keys['S'];
      const isLeft = keys['KeyA'] || keys['ArrowLeft'] || keys['a'] || keys['A'];
      const isRight = keys['KeyD'] || keys['ArrowRight'] || keys['d'] || keys['D'];
      const isSprintKey = keys['ControlLeft'] || keys['ControlRight'] || keys['Control'];
      const isSneakKey = keys['ShiftLeft'] || keys['ShiftRight'] || keys['Shift'];
      const isJumpKey = keys['Space'] || keys[' '];

      let dx = 0;
      let dy = 0;
      if (isUp) dy -= 1;
      if (isDown) dy += 1;
      if (isLeft) dx -= 1;
      if (isRight) dx += 1;

      // 速度計算 (基本130、ダッシュ時240、スニーク時65)
      let baseSpeed = 130;
      if (isSprintKey) baseSpeed *= 1.85;
      else if (isSneakKey) baseSpeed *= 0.5;

      const isMoving = dx !== 0 || dy !== 0;

      // ジャンプ物理 (重力と放物線運動)
      const phys = playerPhysics.current;
      const gravity = 700; // px/s^2

      // 空中でないときにスペースキーでジャンプ開始
      if (isJumpKey && phys.z <= 0) {
        phys.vz = 260; // 上向き初速
        phys.isJumping = true;
      }

      // 垂直移動の積分
      if (phys.isJumping || phys.z > 0) {
        phys.z += phys.vz * dt;
        phys.vz -= gravity * dt;

        if (phys.z <= 0) {
          phys.z = 0;
          phys.vz = 0;
          phys.isJumping = false;
        }
      }

      // 水平移動の積分
      let newX = world.player.position.x;
      let newY = world.player.position.y;
      let dir = world.player.direction;

      if (isMoving) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = (dx / len) * baseSpeed * dt;
        const ny = (dy / len) * baseSpeed * dt;

        newX = Math.round(world.player.position.x + nx);
        newY = Math.round(world.player.position.y + ny);

        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? 'right' : 'left';
        } else {
          dir = dy > 0 ? 'down' : 'up';
        }
      }

      // プレイヤー状態の更新
      updatePlayerState({
        position: { x: newX, y: newY, z: Math.round(phys.z) },
        vz: Math.round(phys.vz),
        direction: dir,
        isMoving,
        isJumping: phys.isJumping,
        isSprinting: isSprintKey && isMoving,
        isSneaking: isSneakKey,
      });

      // レンダリング実行
      if (rendererRef.current) {
        rendererRef.current.render(
          world,
          assets,
          selectedEntityId,
          ghostEntities,
          activeMode === 'play'
        );
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [world, assets, selectedEntityId, ghostEntities, activeMode]);

  // マインクラフトPC版キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // キー押下を記録 (codeとkey両方)
      keysPressed.current[e.code] = true;
      keysPressed.current[e.key] = true;

      // F3: デバッグ画面トグル
      if (e.code === 'F3' || e.key === 'F3') {
        e.preventDefault();
        setIsF3Open((prev) => !prev);
        return;
      }

      // E: インベントリ / パレット開閉トグル
      if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) {
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      // 1 〜 9: パレットアイテムクイック選択
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(e.code)) {
        const slotIdx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        const placeableAssets = Object.values(assets).filter((a) => a.type !== 'tile');
        if (placeableAssets[slotIdx]) {
          const selectedAsset = placeableAssets[slotIdx];
          setPlacingAssetId(selectedAsset.id);
          showNotification(`スロット ${slotIdx + 1}:「${selectedAsset.name}」を選択`);
        }
        return;
      }

      // Q: 選択解除 / ドロップ
      if ((e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey) {
        setSelectedEntityId(null);
        setPlacingAssetId(null);
        return;
      }

      // Undo: Ctrl+Z / ⌘+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y / ⌘+Y または Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // AIパネル: Ctrl+K / ⌘+K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setAIPanelOpen(!isAIPanelOpen);
        return;
      }

      // Esc: 選択解除
      if (e.key === 'Escape') {
        setSelectedEntityId(null);
        setPlacingAssetId(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, isAIPanelOpen, assets]);

  const handleResetCamera = useCallback(() => {
    rendererRef.current?.resetCamera();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090d16] select-none">
      {/* 2.5D Pixi レンダリング Canvas コンテナ */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
        tabIndex={0}
        onClick={(e) => (e.currentTarget as HTMLElement).focus()}
      />

      {/* トップHUD */}
      <TopHUD
        onResetCamera={handleResetCamera}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleF3={() => setIsF3Open((prev) => !prev)}
        isF3Open={isF3Open}
      />

      {/* Minecraft風 F3 デバッグ情報画面 */}
      <DebugOverlayF3 isOpen={isF3Open} fps={fps} />

      {/* コンテキストUI (オブジェクト選択時) */}
      <ObjectContextMenu />

      {/* アセット配置バー (Eキーで開閉) */}
      <AssetPaletteBar isVisible={isPaletteOpen} />

      {/* AIワールド生成 & Gemini画像創出パネル */}
      <AIPanelModal
        onSetGhostPreview={setGhostEntities}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* ダイアログモーダル (NPC会話・オブジェクト調査) */}
      <DialogueModal />

      {/* 操作ヘルプモーダル (Minecraft操作系) */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Gemini API Key 設定モーダル */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => showNotification('Gemini API キーを保存しました！')}
      />

      {/* 通知トースト */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl glass-panel border border-cyan-400/40 text-cyan-200 text-xs font-medium flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <Bell className="w-3.5 h-3.5 text-cyan-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* 画面左下: マイクラ風キーヒント */}
      <div className="absolute bottom-4 left-4 z-20 glass-panel px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-slate-300 pointer-events-none flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-amber-300 border border-white/10">WASD</span>
          <span>移動</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-cyan-300 border border-white/10">Space</span>
          <span>ジャンプ</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-emerald-300 border border-white/10">Ctrl</span>
          <span>ダッシュ</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-purple-300 border border-white/10">Shift</span>
          <span>スニーク</span>
        </div>
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-slate-300 border border-white/10">右クリック</span>
          <span>調べる/話す</span>
        </div>
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-amber-300 border border-white/10">E</span>
          <span>パレット</span>
        </div>
      </div>
    </div>
  );
};
