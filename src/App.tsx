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
import { Bell, Users } from 'lucide-react';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);

  const { world, assets, createObject, moveObject, undo, redo, updatePlayerPosition } = useWorldStore();
  const {
    selectedEntityId,
    setSelectedEntityId,
    activeMode,
    setActiveMode,
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
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [currentAvatarId, setCurrentAvatarId] = useState('character_schoolgirl');
  const [fps, setFps] = useState(60);
  const [ghostEntities, setGhostEntities] = useState<RendererGhostEntity[]>([]);
  const [isDriving, setIsDriving] = useState(false);
  const [nearbyVehicle, setNearbyVehicle] = useState<{ id: string; name: string; assetId: string } | null>(null);

  // 1. レンダラー初期化 (1回のみ実行)
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const renderer = new PixiWorldRenderer();
    rendererRef.current = renderer;
    (window as any).__renderer = renderer;
    renderer.isPlayMode = activeMode === 'play';

    renderer.init(canvasContainerRef.current).then(() => {
      // 初期描画
      renderer.render(world, assets, selectedEntityId, ghostEntities);
      renderer.setPlayerAvatar(currentAvatarId);

      // 左クリック (選択)
      renderer.onEntityClick = (entityId: string) => {
        setSelectedEntityId(entityId);
      };

      // 右クリック (マインクラフト風インタラクション)
      renderer.onEntityRightClick = (entityId: string) => {
        const ent = useWorldStore.getState().world.entities[entityId];
        if (!ent) return;
        const asset = useWorldStore.getState().assets[ent.assetId];
        if (!asset) return;

        // 🏎️ 乗り物乗車インタラクション
        const driveInteraction = asset.interactions?.find((i) => i.type === 'drive');
        if (driveInteraction || asset.category === 'vehicle') {
          renderer.enterVehicle(entityId, ent.assetId);
          setIsDriving(true);
          setNearbyVehicle(null);
          showNotification(`🏎️ ${ent.name} に乗車！[WASD]で爆走 / [Shift・Ctrl]でニトロ加速 / [F]で降車`);
          return;
        }

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

      // プレイヤー移動時の低頻度通知 (FPS更新 & 周囲の乗り物検知)
      let lastTickTime = 0;
      renderer.onPlayerMoveTick = (px, py, _z, _dir, liveFps) => {
        const now = performance.now();
        if (now - lastTickTime < 180) return;
        lastTickTime = now;

        setFps(liveFps);

        const driving = renderer.playerState.isDriving;
        setIsDriving((prev) => (prev !== driving ? driving : prev));

        if (!driving) {
          // 周囲に乗れる車両があるかチェック (距離 85px以内)
          const currentWorld = useWorldStore.getState().world;
          const currentAssets = useWorldStore.getState().assets;
          let foundVehicle: { id: string; name: string; assetId: string } | null = null;
          let minDist = 85;

          for (const ent of Object.values(currentWorld.entities)) {
            const a = currentAssets[ent.assetId];
            if (a?.category === 'vehicle' || a?.interactions?.some((i) => i.type === 'drive')) {
              const d = Math.hypot(ent.position.x - px, ent.position.y - py);
              if (d < minDist) {
                minDist = d;
                foundVehicle = { id: ent.id, name: ent.name || a.name, assetId: ent.assetId };
              }
            }
          }
          setNearbyVehicle((prev) => {
            if (!prev && !foundVehicle) return null;
            if (prev && foundVehicle && prev.id === foundVehicle.id) return prev;
            return foundVehicle;
          });
        } else {
          setNearbyVehicle((prev) => (prev !== null ? null : prev));
        }
      };
    });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // 2. モード変更の同期
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.isPlayMode = activeMode === 'play';
    }
  }, [activeMode]);

  // 3. ワールドデータ変更時のみ再描画（エンティティ追加・天候変更時）
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(world, assets, selectedEntityId, ghostEntities);
    }
  }, [world, assets, selectedEntityId, ghostEntities]);

  // 🏎️ 乗り物乗車・降車トグル
  const handleToggleVehicle = useCallback(async () => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (renderer.playerState.isDriving) {
      // 降車
      const res = await renderer.exitVehicle();
      setIsDriving(false);
      if (res && res.entityId) {
        moveObject(res.entityId, res.x, res.y);
      }
      showNotification('降車しました');
    } else {
      // 乗車: 周囲85px以内の最寄り車両
      const px = renderer.playerState.x;
      const py = renderer.playerState.y;
      const currentWorld = useWorldStore.getState().world;
      const currentAssets = useWorldStore.getState().assets;
      let targetVehicle: { id: string; name: string; assetId: string } | null = null;
      let minDist = 85;

      for (const ent of Object.values(currentWorld.entities)) {
        const asset = currentAssets[ent.assetId];
        if (asset?.category === 'vehicle' || asset?.interactions?.some((i) => i.type === 'drive')) {
          const d = Math.hypot(ent.position.x - px, ent.position.y - py);
          if (d < minDist) {
            minDist = d;
            targetVehicle = { id: ent.id, name: ent.name || asset.name, assetId: ent.assetId };
          }
        }
      }

      if (targetVehicle) {
        await renderer.enterVehicle(targetVehicle.id, targetVehicle.assetId);
        setIsDriving(true);
        setNearbyVehicle(null);
        showNotification(`🏎️ ${targetVehicle.name} に乗車！[WASD]で爆走 / [Shift・Ctrl]でニトロ加速 / [F]で降車`);
      } else {
        showNotification('近くに乗れる乗り物がありません（近づいてFキーを押してください）');
      }
    }
  }, [moveObject, showNotification]);

  // 4. マインクラフトPC版キーボード入力 (レンダラーへ直接入力伝播)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // レンダラーへキー押下を直接伝播 (0ms遅延)
      if (rendererRef.current) {
        rendererRef.current.keys[e.code] = true;
        rendererRef.current.keys[e.key] = true;
      }

      // F: 乗り物乗車 / 降車
      if ((e.code === 'KeyF' || e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleToggleVehicle();
        return;
      }

      // F3: デバッグ画面トグル
      if (e.code === 'F3' || e.key === 'F3') {
        e.preventDefault();
        setIsF3Open((prev) => !prev);
        return;
      }

      // E: パレット開閉トグル
      if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) {
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      // 1 〜 9: パレットアイテム選択
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

      // Q: 選択解除
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
        setIsAvatarPickerOpen(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (rendererRef.current) {
        rendererRef.current.keys[e.code] = false;
        rendererRef.current.keys[e.key] = false;
      }
    };

    // フォーカス外れ時のキー状態全クリア (押しっぱなし状態防止)
    const handleBlur = () => {
      if (rendererRef.current) {
        rendererRef.current.keys = {};
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [undo, redo, isAIPanelOpen, assets, handleToggleVehicle]);

  // モーダル表示時に移動を安全に停止
  useEffect(() => {
    if (isAIPanelOpen || isHelpOpen || isSettingsOpen || isAvatarPickerOpen) {
      if (rendererRef.current) {
        rendererRef.current.keys = {};
      }
    }
  }, [isAIPanelOpen, isHelpOpen, isSettingsOpen, isAvatarPickerOpen]);

  // アバター変更ハンドラー
  const handleSelectAvatar = (assetId: string) => {
    setCurrentAvatarId(assetId);
    rendererRef.current?.setPlayerAvatar(assetId);
    const asset = assets[assetId];
    if (asset) {
      showNotification(`アバターを「${asset.name}」に変更しました`);
    }
    setIsAvatarPickerOpen(false);
  };

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
      />

      {/* トップHUD */}
      <TopHUD
        onResetCamera={handleResetCamera}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleF3={() => setIsF3Open((prev) => !prev)}
        isF3Open={isF3Open}
      />

      {/* アバター切り替えボタン (右上HUD下) */}
      <div className="absolute top-16 right-4 z-30">
        <button
          onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
          className="glass-panel px-3 py-1.5 rounded-2xl flex items-center gap-2 border border-white/15 text-xs text-slate-200 hover:text-white hover:border-cyan-400/50 shadow-lg transition-all cursor-pointer"
          title="アバター変更"
        >
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>キャラ変更</span>
        </button>

        {/* アバター選択ポップオーバー */}
        {isAvatarPickerOpen && (
          <div className="mt-2 w-56 glass-panel rounded-2xl border border-cyan-400/40 p-2 space-y-1 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="text-[10px] text-slate-400 px-2 py-1 font-semibold uppercase tracking-wider">
              操作キャラクター選択
            </div>
            {[
              { id: 'character_schoolgirl', name: '女子高校生（あおい）', desc: '黒髪セーラー服' },
              { id: 'character_boy', name: '昭和少年（ケンタ）', desc: '赤いキャップ＆短パン' },
              { id: 'character_salaryman', name: '会社員（たなか）', desc: 'グレースーツ＆メガネ' },
            ].map((av) => (
              <button
                key={av.id}
                onClick={() => handleSelectAvatar(av.id)}
                className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-left transition-all ${
                  currentAvatarId === av.id
                    ? 'bg-cyan-500/30 border border-cyan-400/50 text-white font-bold'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                <div>
                  <div className="text-xs">{av.name}</div>
                  <div className="text-[10px] text-slate-400">{av.desc}</div>
                </div>
                {currentAvatarId === av.id && <span className="text-xs text-cyan-300">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* ダイアログモーダル */}
      <DialogueModal />

      {/* 操作ヘルプモーダル */}
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

      {/* 🏎️ 乗り物運転中 HUD */}
      {isDriving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-2xl glass-panel border border-amber-400/50 text-amber-200 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏎️</span>
            <div>
              <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>ランボルギーニ・ウラカン</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 text-[9px] border border-amber-400/40">爆走中</span>
              </div>
              <div className="text-[10px] text-amber-300/80 font-mono">V10 5.2L AWD | 最高速 325km/h</div>
            </div>
          </div>
          <div className="w-[1px] h-6 bg-white/15" />
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-black/50 text-amber-300 font-mono text-[10px] border border-amber-400/30">
              Shift / Ctrl
            </span>
            <span className="text-slate-300 text-[11px]">ニトロ加速</span>
          </div>
          <button
            onClick={handleToggleVehicle}
            className="px-3.5 py-1.5 rounded-xl bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 text-red-100 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-red-200 border border-red-400/30">F</span>
            <span>降車する</span>
          </button>
        </div>
      )}

      {/* 🚗 周囲に乗り物がある時の乗車プロンプト */}
      {nearbyVehicle && !isDriving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl glass-panel border border-cyan-400/50 text-cyan-100 shadow-2xl flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="text-2xl">🏎️</span>
          <div>
            <div className="text-xs font-bold text-white">
              <span className="text-amber-300">{nearbyVehicle.name}</span>
            </div>
            <div className="text-[10px] text-slate-400">近づいて乗車できます</div>
          </div>
          <button
            onClick={handleToggleVehicle}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/30 to-amber-600/30 hover:from-amber-500/50 hover:to-amber-600/50 border border-amber-400/60 text-amber-200 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-amber-300 border border-amber-400/30">F</span>
            <span>乗る</span>
          </button>
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
        <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-amber-300 border border-amber-400/30">F</span>
          <span>乗降</span>
        </div>
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-slate-300 border border-white/10">右クリック</span>
          <span>調べる/乗る</span>
        </div>
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-amber-300 border border-white/10">E</span>
          <span>パレット</span>
        </div>
      </div>
    </div>
  );
};
