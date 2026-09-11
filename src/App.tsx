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
import { Bell, Users, Globe, Bed } from 'lucide-react';
import { audioManager } from './audio/AudioManager';
import { MobileTouchControls } from './ui/touch/MobileTouchControls';
import { multiplayerManager, RemotePlayerInfo } from './core/multiplayer/MultiplayerManager';
import { ChatSystem } from './ui/chat/ChatSystem';
import { PortalLandingModal } from './ui/portal/PortalLandingModal';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);

  const { world, assets, createObject, moveObject, undo, redo, updatePlayerPosition, setTileAt } = useWorldStore();
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
    isMuted,
    toggleMute,
  } = useUIStore();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isF3Open, setIsF3Open] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [currentAvatarId, setCurrentAvatarId] = useState('character_schoolgirl');
  const [ghostEntities, setGhostEntities] = useState<RendererGhostEntity[]>([]);
  const [isDriving, setIsDriving] = useState(false);
  const [isSitting, setIsSitting] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [nearbyVehicle, setNearbyVehicle] = useState<{ id: string; name: string; assetId: string } | null>(null);
  const [nearbyBench, setNearbyBench] = useState<{ id: string; name: string } | null>(null);
  const [nearbyBed, setNearbyBed] = useState<{ id: string; name: string } | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerInfo[]>([]);
  const [peerOnlineInfo, setPeerOnlineInfo] = useState<{ count: number; isOnline: boolean }>({ count: 0, isOnline: false });
  const [playerScreenPos, setPlayerScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [isLowPerfMode, setIsLowPerfMode] = useState(false);
  const [bgmTrackInfo, setBgmTrackInfo] = useState<{ title: string; isPlaying: boolean }>(() => {
    const cur = audioManager.getCurrentBgmTrack();
    return { title: cur.track.title, isPlaying: cur.isPlaying };
  });

  // サウンドミュート状態の同期
  useEffect(() => {
    audioManager.setMuted(isMuted);
  }, [isMuted]);

  // BGMトラック変更監視
  useEffect(() => {
    audioManager.onTrackChange = (track, isPlaying) => {
      setBgmTrackInfo({ title: track.title, isPlaying });
    };
  }, []);

  // 天候変更時に対応するGemini BGMへ自動クロスフェード
  useEffect(() => {
    if (world.environment.weather) {
      audioManager.switchBgmForWeather(world.environment.weather);
    }
  }, [world.environment.weather]);

  // モード切り替え時のパレット表示制御 (スマホ時は探索中は隠して視界を確保)
  useEffect(() => {
    if (activeMode === 'edit') {
      setIsPaletteOpen(true);
    } else if (window.innerWidth <= 768) {
      setIsPaletteOpen(false);
    }
  }, [activeMode]);

  // 1. レンダラー初期化 (1回のみ実行)
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    let vehicleClearTimer: any = null;
    let benchClearTimer: any = null;

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

        // 🛏️ ベッド就寝インタラクション（同衾・一緒に寝る）
        if (asset.category === 'furniture' && (asset.interactions?.some((i) => i.type === 'sleep') || ent.assetId.includes('bed'))) {
          const sleeping = renderer.toggleSleep(entityId);
          setIsSleeping(sleeping);
          if (sleeping) {
            audioManager.playSleep();
            showNotification(`🛏️ ${ent.name} でおやすみ中... [WASD]または[Space]で起床`);
          } else {
            showNotification('ベッドから起きました');
          }
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

      // マップクリック (配置または選択解除、あるいはバケツ操作)
      renderer.onMapClick = (worldX: number, worldY: number) => {
        const currentPlacing = useUIStore.getState().placingAssetId;

        // 🪣 空のバケツで水汲み
        if (currentPlacing === 'tool_bucket_empty') {
          const currentWorld = useWorldStore.getState().world;
          const tileSize = currentWorld.map.tileSize || 32;
          const chunkSize = currentWorld.map.chunkSize || 16;
          const tileX = Math.floor(worldX / tileSize);
          const tileY = Math.floor(worldY / tileSize);
          const cx = Math.floor(tileX / chunkSize);
          const cy = Math.floor(tileY / chunkSize);
          const chunk = currentWorld.map.chunks[`${cx},${cy}`];
          const lx = ((tileX % chunkSize) + chunkSize) % chunkSize;
          const ly = ((tileY % chunkSize) + chunkSize) % chunkSize;
          const tile = chunk?.tiles?.[ly]?.[lx];

          if (tile && tile.tileId.toLowerCase().includes('water')) {
            audioManager.playWaterScoop();
            setPlacingAssetId('tool_bucket_water');
            showNotification('🪣 川から澄んだ水を汲みました！（水入りバケツになりました）');
            return;
          } else {
            showNotification('水面をクリックすると水を汲めます');
            return;
          }
        }

        // 🌊 水入りバケツで水を撒いて川タイル作成 & 連結
        if (currentPlacing === 'tool_bucket_water') {
          audioManager.playWaterSplash();
          setTileAt(worldX, worldY, 'tile_water');
          renderer.refreshTiles(useWorldStore.getState().world);
          showNotification('🌊 水を流して清流を作りました！川が自然に繋がります');
          return;
        }

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

      // プレイヤー移動時の低頻度通知 (周囲の乗り物・ベンチ・ベッド検知 & F3用FPS通知 & マルチプレイヤー送信)
      let lastTickTime = 0;
      let activeVehicleId: string | null = null;
      let activeBenchId: string | null = null;
      let activeBedId: string | null = null;

      renderer.onPlayerMoveTick = (px, py, _z, _dir, liveFps) => {
        // 👥 マルチプレイヤー状態を送信（ジャンプやダッシュ、アクションを瞬時に相手端末へ同期）
        multiplayerManager.sendMyState({
          assetId: renderer.playerState.assetId,
          x: px,
          y: py,
          z: _z,
          direction: _dir,
          isMoving: renderer.playerState.isMoving,
          isSprinting: renderer.playerState.isSprinting,
          isDriving: renderer.playerState.isDriving,
          isSitting: renderer.playerState.isSitting,
          isSleeping: renderer.playerState.isSleeping,
        });

        const now = performance.now();
        if (now - lastTickTime < 120) return;
        lastTickTime = now;

        // F3デバッグ用FPS更新
        useUIStore.getState().setFps(liveFps);

        // プレイヤーの画面座標を更新（頭上チャットフキダシ用）
        const sPos = renderer.worldToScreen(px, py - _z);
        setPlayerScreenPos(sPos);

        const driving = renderer.playerState.isDriving;
        const sitting = renderer.playerState.isSitting;
        const sleeping = renderer.playerState.isSleeping;
        setIsDriving((prev) => (prev !== driving ? driving : prev));
        setIsSitting((prev) => (prev !== sitting ? sitting : prev));
        setIsSleeping((prev) => (prev !== sleeping ? sleeping : prev));

        if (driving || sitting || sleeping) {
          activeVehicleId = null;
          activeBenchId = null;
          activeBedId = null;
          if (vehicleClearTimer) clearTimeout(vehicleClearTimer);
          if (benchClearTimer) clearTimeout(benchClearTimer);
          setNearbyVehicle(null);
          setNearbyBench(null);
          setNearbyBed(null);
        } else {
          const currentWorld = useWorldStore.getState().world;
          const currentAssets = useWorldStore.getState().assets;

          // 🏎️ 車両の検出
          let foundVehicle: { id: string; name: string; assetId: string } | null = null;
          for (const ent of Object.values(currentWorld.entities)) {
            if (ent.id === renderer.playerState.drivingEntityId) continue;
            const a = currentAssets[ent.assetId];
            if (a?.category === 'vehicle' || a?.interactions?.some((i) => i.type === 'drive')) {
              const d = Math.hypot(ent.position.x - px, ent.position.y - py);
              const maxDist = (activeVehicleId === ent.id) ? 140 : 85;
              if (d < maxDist) {
                foundVehicle = { id: ent.id, name: ent.name || a.name || '黄色いランボルギーニ', assetId: ent.assetId };
                break;
              }
            }
          }

          if (foundVehicle) {
            if (vehicleClearTimer) {
              clearTimeout(vehicleClearTimer);
              vehicleClearTimer = null;
            }
            activeVehicleId = foundVehicle.id;
            setNearbyVehicle((prev) => {
              if (prev && prev.id === foundVehicle!.id && prev.name === foundVehicle!.name) return prev;
              return foundVehicle;
            });
          } else if (activeVehicleId) {
            if (!vehicleClearTimer) {
              vehicleClearTimer = setTimeout(() => {
                activeVehicleId = null;
                vehicleClearTimer = null;
                setNearbyVehicle(null);
              }, 300);
            }
          }

          // 🛋️ ベンチの検出
          let foundBench: { id: string; name: string } | null = null;
          for (const ent of Object.values(currentWorld.entities)) {
            const a = currentAssets[ent.assetId];
            if (a?.interactions?.some((i) => i.type === 'sit')) {
              const d = Math.hypot(ent.position.x - px, ent.position.y - py);
              const maxBenchDist = (activeBenchId === ent.id) ? 95 : 45;
              if (d < maxBenchDist) {
                foundBench = { id: ent.id, name: ent.name || a.name };
                break;
              }
            }
          }

          if (foundBench) {
            if (benchClearTimer) {
              clearTimeout(benchClearTimer);
              benchClearTimer = null;
            }
            activeBenchId = foundBench.id;
            setNearbyBench((prev) => {
              if (prev && prev.id === foundBench!.id && prev.name === foundBench!.name) return prev;
              return foundBench;
            });
          } else if (activeBenchId) {
            if (!benchClearTimer) {
              benchClearTimer = setTimeout(() => {
                activeBenchId = null;
                benchClearTimer = null;
                setNearbyBench(null);
              }, 300);
            }
          }

          // 🛏️ ベッドの検出
          let foundBed: { id: string; name: string } | null = null;
          for (const ent of Object.values(currentWorld.entities)) {
            const a = currentAssets[ent.assetId];
            if (a?.interactions?.some((i) => i.type === 'sleep') || (a?.category === 'furniture' && ent.assetId.includes('bed'))) {
              const d = Math.hypot(ent.position.x - px, ent.position.y - py);
              const maxBedDist = (activeBedId === ent.id) ? 95 : 55;
              if (d < maxBedDist) {
                foundBed = { id: ent.id, name: ent.name || a.name || 'ダブルベッド' };
                break;
              }
            }
          }

          if (foundBed) {
            activeBedId = foundBed.id;
            setNearbyBed((prev) => {
              if (prev && prev.id === foundBed!.id && prev.name === foundBed!.name) return prev;
              return foundBed;
            });
          } else if (activeBedId) {
            activeBedId = null;
            setNearbyBed(null);
          }
        }
      };
    });

    return () => {
      if (vehicleClearTimer) clearTimeout(vehicleClearTimer);
      if (benchClearTimer) clearTimeout(benchClearTimer);
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
        setTimeout(() => {
          renderer.renderStaticShadows();
        }, 50);
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

  // 🛋️ ベンチ着席・立ち上がりトグル
  const handleToggleSit = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const sat = renderer.toggleSit();
    setIsSitting(sat);
    if (sat) {
      showNotification('🛋️ 木製ベンチで休憩中（[WASD] または [Space] で立ち上がります）');
    } else {
      showNotification('立ち上がりました');
    }
  }, [showNotification]);

  // 🛏️ ベッド就寝トグル（同衾・一緒に寝る）
  const handleToggleSleep = useCallback((bedEntityId?: string) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const sleeping = renderer.toggleSleep(bedEntityId);
    setIsSleeping(sleeping);
    if (sleeping) {
      audioManager.playSleep();
      showNotification('🛏️ ふかふかダブルベッドでおやすみ中... [WASD] または [Space] で起床');
    } else {
      showNotification('ベッドから起きました');
    }
  }, [showNotification]);

  // 👥 マルチプレイヤー管理（WebRTC PeerJS & BroadcastChannel）
  useEffect(() => {
    multiplayerManager.init();

    multiplayerManager.onRemotePlayersChange = (players) => {
      setRemotePlayers(players);
      rendererRef.current?.updateRemotePlayers(players);
    };

    multiplayerManager.onConnectionStatusChange = (count, isOnline) => {
      setPeerOnlineInfo({ count, isOnline });
    };

    return () => {
      multiplayerManager.destroy();
    };
  }, []);

  // 4. マインクラフトPC版キーボード入力 (レンダラーへ直接入力伝播)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // レンダラーへキー押下を直接伝播 (0ms遅延 & ダブルタップダッシュ判定)
      if (rendererRef.current) {
        rendererRef.current.onKeyDown(e.code);
        rendererRef.current.keys[e.key] = true;
      }

      // 🛏️ 就寝中の起床判定
      if (rendererRef.current?.playerState.isSleeping) {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyF', 'Escape'].includes(e.code)) {
          handleToggleSleep();
          return;
        }
      }

      // F: 乗り物乗車 / 降車 / ベンチ着席・立ち上がり / ベッド就寝
      if ((e.code === 'KeyF' || e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        if (rendererRef.current?.playerState.isSleeping) {
          handleToggleSleep();
          return;
        }
        if (rendererRef.current?.playerState.isSitting) {
          handleToggleSit();
          return;
        }
        if (rendererRef.current?.playerState.isDriving) {
          handleToggleVehicle();
          return;
        }
        if (nearbyVehicle) {
          handleToggleVehicle();
          return;
        }
        if (nearbyBench) {
          handleToggleSit();
          return;
        }
        if (nearbyBed) {
          handleToggleSleep(nearbyBed.id);
          return;
        }
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

      // M: サウンド ミュート / アンミュート切り替え
      if ((e.code === 'KeyM' || e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) {
        toggleMute();
        const willMute = !isMuted;
        showNotification(willMute ? '🔇 サウンドをミュートにしました' : '🔊 サウンドをオンにしました');
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
        rendererRef.current.onKeyUp(e.code);
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

  // ⚡ 低負荷モード切り替えハンドラー
  const handleTogglePerfMode = useCallback(() => {
    setIsLowPerfMode((prev) => {
      const next = !prev;
      rendererRef.current?.setLowPerformanceMode(next);
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('perf-mode', next);
      }
      showNotification(next ? '⚡ 低負荷モード (ブラー無効化・GPU負荷激減) を有効にしました' : '✨ 通常グラフィックモードに切り替えました');
      return next;
    });
  }, [showNotification]);

  // 🎵 BGMトグル＆曲送りハンドラー
  const handleToggleBgm = useCallback(() => {
    audioManager.toggleBgm();
  }, []);

  const handleNextBgm = useCallback(() => {
    audioManager.nextBgm();
    const cur = audioManager.getCurrentBgmTrack();
    showNotification(`🎵 BGM: ${cur.track.title}`);
  }, [showNotification]);

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
        currentBgmTitle={bgmTrackInfo.title}
        isBgmPlaying={bgmTrackInfo.isPlaying}
        onToggleBgm={handleToggleBgm}
        onNextBgm={handleNextBgm}
        isLowPerfMode={isLowPerfMode}
        onTogglePerfMode={handleTogglePerfMode}
      />

      {/* 右上操作ボタン群 (P2P同期状況 / ポータル / アバター切り替え: z-40で最前面・スマホタップ即応) */}
      <div
        className="absolute top-[90px] sm:top-16 right-3 sm:right-4 z-40 flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end pointer-events-auto"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* 🟢 リアルタイムマルチプレイヤー同期バッジ */}
        <button
          onClick={() => setIsPortalOpen(true)}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsPortalOpen(true);
          }}
          className="glass-panel px-2.5 sm:px-3 py-1.5 rounded-2xl flex items-center gap-1.5 border border-cyan-400/40 text-xs shadow-lg transition-all cursor-pointer bg-slate-950/80 hover:border-cyan-300 backdrop-blur-md active:scale-95"
          title={`ルーム: ${multiplayerManager.roomId} (${multiplayerManager.isHost ? 'ホスト' : 'クライアント'}) - クリックでQRコード表示`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              remotePlayers.length > 0
                ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                : 'bg-cyan-400'
            }`}
          />
          <span className="font-extrabold text-[10px] sm:text-[11px] text-white tracking-tight">
            {remotePlayers.length > 0
              ? `同期中 (${remotePlayers.length + 1}人)`
              : multiplayerManager.isHost
              ? 'ホスト待受中'
              : 'P2P接続中'}
          </span>
        </button>

        <button
          onClick={() => setIsPortalOpen(true)}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsPortalOpen(true);
          }}
          className="glass-panel px-2.5 sm:px-3 py-1.5 rounded-2xl flex items-center gap-1.5 border border-indigo-400/40 text-xs text-indigo-200 hover:text-white hover:border-indigo-400 shadow-lg hover:shadow-indigo-500/20 transition-all cursor-pointer bg-indigo-950/60 active:scale-95"
          title="スマホ接続・公開ポータル"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[10px] sm:text-xs">公開ポータル</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsAvatarPickerOpen((prev) => !prev);
            }}
            className="glass-panel px-2.5 sm:px-3 py-1.5 rounded-2xl flex items-center gap-1.5 sm:gap-2 border border-white/15 text-xs text-slate-200 hover:text-white hover:border-cyan-400/50 shadow-lg transition-all cursor-pointer active:scale-95 bg-slate-900/80"
            title="アバター変更"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] sm:text-xs">キャラ変更</span>
          </button>

          {/* アバター選択ポップオーバー */}
          {isAvatarPickerOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-56 glass-panel rounded-2xl border border-cyan-400/40 p-2 space-y-1 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 z-50 bg-slate-950/95 backdrop-blur-xl"
              onTouchStart={(e) => e.stopPropagation()}
            >
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
      </div>

      {/* Minecraft風 F3 デバッグ情報画面 */}
      <DebugOverlayF3 isOpen={isF3Open} />

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
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl glass-panel border border-cyan-400/40 text-cyan-200 text-xs font-medium flex items-center gap-2 shadow-xl transition-all duration-200">
          <Bell className="w-3.5 h-3.5 text-cyan-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* 🏎️ 乗り物運転中 HUD (PCのみキー操作説明を表示、スマホでは右下の降りるボタンのみでクリアな視界を確保) */}
      {isDriving && (
        <div className="hidden md:flex fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-2xl glass-panel border border-amber-400/50 text-amber-200 shadow-2xl items-center gap-4 transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏎️</span>
            <div>
              <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <span className="text-amber-300">黄色いランボルギーニ</span>
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

      {/* 🛋️ ベンチ休憩中 HUD */}
      {isSitting && (
        <div className="fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-2xl glass-panel border border-emerald-400/50 text-emerald-200 shadow-2xl flex items-center gap-4 transition-all duration-200 whitespace-nowrap max-w-[92vw]">
          <span className="text-2xl">🛋️</span>
          <div>
            <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>木製ベンチで休憩中</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 text-[9px] border border-emerald-400/40">リラックス</span>
            </div>
            <div className="text-[10px] text-emerald-300/80">[WASD] または [Space] で立ち上がります</div>
          </div>
          <button
            onClick={handleToggleSit}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleSit();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-400/50 text-emerald-100 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-emerald-200 border border-emerald-400/30 hidden md:inline">F</span>
            <span>立ち上がる</span>
          </button>
        </div>
      )}

      {/* 🛏️ ベッド就寝中 HUD */}
      {isSleeping && (
        <div className="fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-2xl glass-panel border border-indigo-400/50 text-indigo-100 shadow-2xl flex items-center gap-4 transition-all duration-200 whitespace-nowrap max-w-[92vw] bg-indigo-950/60">
          <span className="text-2xl">🛏️</span>
          <div>
            <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>ふかふかダブルベッドでおやすみ中...</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 text-[9px] border border-indigo-400/40">Zzz...</span>
            </div>
            <div className="text-[10px] text-indigo-300/80">[WASD] または [Space] で起床します</div>
          </div>
          <button
            onClick={() => handleToggleSleep()}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleSleep();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/50 text-indigo-100 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-indigo-200 border border-indigo-400/30 hidden md:inline">F</span>
            <span>起きる</span>
          </button>
        </div>
      )}

      {/* 🚗 周囲に乗り物がある時の乗車プロンプト (スマホでは専用ボタンがあるためPC専用) */}
      {nearbyVehicle && !isDriving && !isSitting && !isSleeping && (
        <div className="hidden md:flex fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl glass-panel border border-cyan-400/50 text-cyan-100 shadow-2xl items-center gap-3.5 transition-all duration-200 whitespace-nowrap max-w-[92vw]">
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

      {/* 🛋️ 周囲にベンチがある時の着席プロンプト (PC専用) */}
      {nearbyBench && !isSitting && !isDriving && !isSleeping && !nearbyVehicle && (
        <div className="hidden md:flex fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl glass-panel border border-emerald-400/50 text-emerald-100 shadow-2xl items-center gap-3.5 transition-all duration-200 whitespace-nowrap max-w-[92vw]">
          <span className="text-2xl">🛋️</span>
          <div>
            <div className="text-xs font-bold text-white">
              <span className="text-emerald-300">{nearbyBench.name}</span>
            </div>
            <div className="text-[10px] text-slate-400">近づいてひと休みできます</div>
          </div>
          <button
            onClick={handleToggleSit}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 hover:from-emerald-500/50 hover:to-emerald-600/50 border border-emerald-400/60 text-emerald-200 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-emerald-300 border border-emerald-400/30">F</span>
            <span>座る</span>
          </button>
        </div>
      )}

      {/* 🛏️ 周囲にベッドがある時の就寝プロンプト (PC専用) */}
      {nearbyBed && !isSleeping && !isSitting && !isDriving && !nearbyVehicle && !nearbyBench && (
        <div className="hidden md:flex fixed bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl glass-panel border border-indigo-400/50 text-indigo-100 shadow-2xl items-center gap-3.5 transition-all duration-200 whitespace-nowrap max-w-[92vw]">
          <span className="text-2xl">🛏️</span>
          <div>
            <div className="text-xs font-bold text-white">
              <span className="text-indigo-300">{nearbyBed.name}</span>
            </div>
            <div className="text-[10px] text-slate-400">近づいて一緒に眠れます</div>
          </div>
          <button
            onClick={() => handleToggleSleep(nearbyBed.id)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/30 to-purple-600/30 hover:from-indigo-500/50 hover:to-purple-600/50 border border-indigo-400/60 text-indigo-200 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-indigo-300 border border-indigo-400/30">F</span>
            <span>眠る</span>
          </button>
        </div>
      )}

      {/* 💬 頭上フキダシチャット & メッセージ送受信 */}
      <ChatSystem
        remotePlayers={remotePlayers}
        playerScreenPos={playerScreenPos}
        renderer={rendererRef.current}
      />

      {/* 🌐 全プラットフォーム公開ポータル & スマホ接続共有モーダル */}
      <PortalLandingModal isOpen={isPortalOpen} onClose={() => setIsPortalOpen(false)} />

      {/* 📱 スマホ・マルチタッチ操作バーチャルジョイスティック */}
      <MobileTouchControls
        renderer={rendererRef.current}
        isDriving={isDriving}
        isSitting={isSitting}
        nearbyVehicleName={nearbyVehicle?.name}
        nearbyBenchName={nearbyBench?.name}
        onToggleVehicle={handleToggleVehicle}
        onToggleSit={handleToggleSit}
      />

      {/* 画面左下: マイクラ風キーヒント (PCのみ表示) */}
      <div className="hidden md:flex absolute bottom-4 left-4 z-20 glass-panel px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-slate-300 pointer-events-none items-center gap-3">
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
          <span>乗降/座る</span>
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
