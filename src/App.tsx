import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWorldStore } from './store/useWorldStore';
import { useUIStore } from './store/useUIStore';
import { PixiWorldRenderer, DIRECTION_LABELS } from './renderer/pixi/PixiWorldRenderer';
import { Direction } from './core/types/world';
import { TopHUD } from './ui/hud/TopHUD';
import { ObjectContextMenu } from './ui/context/ObjectContextMenu';
import { AIPanelModal } from './ui/ai-panel/AIPanelModal';
import { AssetPaletteBar } from './ui/editor/AssetPaletteBar';
import { DialogueModal } from './ui/components/DialogueModal';
import { HelpModal } from './ui/components/HelpModal';
import { SettingsModal } from './ui/components/SettingsModal';
import { DebugOverlayF3 } from './ui/hud/DebugOverlayF3';
import { InventoryModal } from './ui/editor/InventoryModal';
import { RendererGhostEntity } from './renderer/IRenderer';
import { Bell, Users, Globe, Bed, BookOpen } from 'lucide-react';
import { audioManager } from './audio/AudioManager';
import { MobileTouchControls } from './ui/touch/MobileTouchControls';
import { multiplayerManager, RemotePlayerInfo } from './core/multiplayer/MultiplayerManager';
import { ChatSystem } from './ui/chat/ChatSystem';
import { PortalLandingModal } from './ui/portal/PortalLandingModal';
import { FriendBookModal } from './ui/friends/FriendBookModal';
import { FriendStorage, FriendProfile } from './core/storage/FriendStorage';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);

  const {
    world,
    assets,
    createObject,
    moveObject,
    updateObjectPositionDirect,
    updateObjectDirectionDirect,
    commitMoveObject,
    undo,
    redo,
    updatePlayerPosition,
    setTileAt,
  } = useWorldStore();
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
    isSnapToGrid,
    hotbarSlots,
    toggleInventory,
  } = useUIStore();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isFriendBookOpen, setIsFriendBookOpen] = useState(false);
  const [incomingFriend, setIncomingFriend] = useState<{ name: string; houseId: string; roomId: string } | null>(null);
  const [isF3Open, setIsF3Open] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // 招待URLからのアクセス検知 (?friend=xxx または ?hostFriend=xxx)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const friendName = params.get('friend') || params.get('hostFriend');
    const houseId = params.get('house') || '';
    const room = params.get('room') || '';

    if (friendName) {
      FriendStorage.getFriends().then((friends) => {
        const alreadyAdded = friends.some((f) => f.name === friendName || (houseId && f.houseId === houseId));
        if (!alreadyAdded) {
          setIncomingFriend({
            name: friendName,
            houseId: houseId || `house_${friendName}`,
            roomId: room ? `airas_room_${room}` : 'airas_main_room',
          });
        }
      });
    }
  }, []);
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
  const [isLowPerfMode, setIsLowPerfMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('airas_low_perf_mode');
    return saved !== null ? saved === 'true' : true; // ⚡ デフォルトで低負荷モードON！
  });
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
    renderer.isSnapToGrid = isSnapToGrid;

    renderer.init(canvasContainerRef.current).then(async () => {
      // ⚡ 低負荷モードの初期適用 (デフォルトONで起動直後から最高に軽快)
      renderer.setLowPerformanceMode(isLowPerfMode);
      if (typeof document !== 'undefined' && isLowPerfMode) {
        document.body.classList.add('perf-mode');
      }

      // 初期描画
      await renderer.render(world, assets, selectedEntityId, ghostEntities);
      await renderer.setPlayerAvatar(currentAvatarId);

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

      // オブジェクトドラッグ移動 (ドラッグ中は軽量リアルタイム更新)
      renderer.onEntityDrag = (entityId: string, newX: number, newY: number, direction?: Direction) => {
        updateObjectPositionDirect(entityId, newX, newY, direction);
      };

      // オブジェクト回転通知 (ドラッグ中のタップ回転・キー回転)
      renderer.onEntityRotate = (entityId: string, newDir: Direction) => {
        updateObjectDirectionDirect(entityId, newDir);
        const label = DIRECTION_LABELS[newDir] || newDir;
        showNotification(`🔄 向き: ${label}`);
      };

      // オブジェクトドロップ完了 (離した瞬間に開始位置から最終位置への単一コマンドを登録 ➜ 1回のUndoで元の位置に一発復帰！)
      renderer.onEntityDragEnd = (
        entityId: string,
        startPos,
        endPos,
        startDir?: Direction,
        endDir?: Direction
      ) => {
        commitMoveObject(entityId, startPos, endPos, startDir, endDir);
        if (startDir !== endDir && startPos.x === endPos.x && startPos.y === endPos.y) {
          const label = DIRECTION_LABELS[endDir || 'down'] || endDir;
          showNotification(`🔄 向きを変更しました (${label})`);
        } else {
          showNotification('オブジェクトを移動しました');
        }
      };

      // 🛋️ ベンチ自動着席（しゃがみキー/ボタンで自動着席した時のHUD通知）
      renderer.onAutoSitTriggered = (_benchId: string) => {
        setIsSitting(true);
        setNearbyBench(null);
        showNotification('🛋️ ベンチに腰掛けました [WASD]または[Space]で立ち上がる');
      };

      // プレイヤー移動時の低頻度通知 (周囲の乗り物・ベンチ・ベッド検知 & F3用FPS通知 & マルチプレイヤー送信)
      let lastTickTime = 0;
      let lastCheckPx = -9999;
      let lastCheckPy = -9999;
      let activeVehicleId: string | null = null;
      let activeBenchId: string | null = null;
      let activeBedId: string | null = null;

      renderer.onPlayerMoveTick = (px, py, _z, _dir, liveFps) => {
        const isMoving = renderer.playerState.isMoving || renderer.playerState.isJumping;

        // 👥 マルチプレイヤー状態送信 (移動中は高頻度、静止中は低頻度に間引きCPU削減)
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
          return;
        }

        // 🚀 超軽量化: プレイヤーが前回のチェックからほとんど動いていない場合、高コストな全オブジェクト走査を完全スキップ！
        const movedDist = Math.hypot(px - lastCheckPx, py - lastCheckPy);
        if (movedDist < 8 && !isMoving) {
          return;
        }
        lastCheckPx = px;
        lastCheckPy = py;

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
                foundVehicle = { id: ent.id, name: ent.name || a.name || 'ランボルギーニ', assetId: ent.assetId };
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
        };
      });

    return () => {
      if (vehicleClearTimer) clearTimeout(vehicleClearTimer);
      if (benchClearTimer) clearTimeout(benchClearTimer);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // 2. モード変更・グリッド吸着の同期
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.isPlayMode = activeMode === 'play';
      rendererRef.current.isSnapToGrid = isSnapToGrid;
    }
  }, [activeMode, isSnapToGrid]);

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
        updateObjectPositionDirect(res.entityId, res.x, res.y, res.direction);
        const curEnt = useWorldStore.getState().world.entities[res.entityId];
        if (curEnt) {
          commitMoveObject(
            res.entityId,
            { x: curEnt.position.x, y: curEnt.position.y },
            { x: res.x, y: res.y },
            curEnt.direction,
            res.direction
          );
        }
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

    multiplayerManager.onWorldEditReceived = (packet) => {
      useWorldStore.getState().applyRemoteWorldEdit(packet);
      const updatedWorld = useWorldStore.getState().world;
      rendererRef.current?.syncWorld(updatedWorld);
    };

    multiplayerManager.onConnectionStatusChange = (count, isOnline) => {
      setPeerOnlineInfo({ count, isOnline });
      // 👑 ホスト側: 接続者が増えた時に最新マップ全体を全同期配信
      if (multiplayerManager.isHost && count > 0) {
        try {
          multiplayerManager.broadcastWorldEdit('full_sync', useWorldStore.getState().world);
        } catch (_) {}
      }
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
        rendererRef.current.onKeyDown(e.code, e.repeat);
        rendererRef.current.keys[e.key] = true;
      }

      // 🦘 Space: ジャンプ（直前にクリックしたボタンがフォーカスされたままでスペースキー再発火する事故を完全防止）
      if (e.code === 'Space') {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && activeEl !== document.body && activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
          activeEl.blur();
        }
        e.preventDefault();
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

      // E: マイクラ風インベントリ開閉トグル
      if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) {
        toggleInventory();
        return;
      }

      // 1 〜 9, 0: ホットバースロットアイテム選択
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'].includes(e.code)) {
        const digitStr = e.code.replace('Digit', '');
        const slotIdx = digitStr === '0' ? 9 : parseInt(digitStr, 10) - 1;
        const targetAssetId = hotbarSlots[slotIdx];
        if (targetAssetId && assets[targetAssetId]) {
          const selectedAsset = assets[targetAssetId];
          setPlacingAssetId(selectedAsset.id);
          showNotification(`スロット [${digitStr}]:「${selectedAsset.name}」を選択`);
        } else {
          showNotification(`スロット [${digitStr}] は空です (Eキーでアイテムをセット)`);
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
      try {
        localStorage.setItem('airas_low_perf_mode', String(next));
      } catch {}
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
        multiplayerSlot={
          <>
            {/* 🟢 リアルタイムマルチプレイヤー同期バッジ */}
            <button
              onClick={() => setIsPortalOpen(true)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsPortalOpen(true);
              }}
              className="glass-panel px-2 py-1 rounded-xl flex items-center gap-1 border border-cyan-400/40 text-xs shadow-lg transition-all cursor-pointer bg-slate-950/80 hover:border-cyan-300 backdrop-blur-md active:scale-95 shrink-0"
              title={`ルーム: ${multiplayerManager.roomId} (${multiplayerManager.isHost ? 'ホスト' : 'クライアント'}) - クリックでQRコード表示`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  remotePlayers.length > 0
                    ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                    : 'bg-cyan-400'
                }`}
              />
              <span className="font-extrabold text-[10px] text-white tracking-tight whitespace-nowrap">
                {remotePlayers.length > 0
                  ? `同期 (${remotePlayers.length + 1})`
                  : multiplayerManager.isHost
                  ? '待受中'
                  : '接続中'}
              </span>
            </button>

            {/* 🌐 公開ポータル */}
            <button
              onClick={() => setIsPortalOpen(true)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsPortalOpen(true);
              }}
              className="glass-panel px-1.5 py-1 rounded-xl flex items-center gap-1 border border-indigo-400/40 text-xs text-indigo-200 hover:text-white hover:border-indigo-400 shadow-lg hover:shadow-indigo-500/20 transition-all cursor-pointer bg-indigo-950/60 active:scale-95 shrink-0"
              title="スマホ接続・公開ポータル"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
              <span className="text-[10px] hidden min-[400px]:inline whitespace-nowrap">ポータル</span>
            </button>

            {/* 👥 キャラ変更 */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsAvatarPickerOpen((prev) => !prev);
                }}
                className="glass-panel px-1.5 py-1 rounded-xl flex items-center gap-1 border border-white/15 text-xs text-slate-200 hover:text-white hover:border-cyan-400/50 shadow-lg transition-all cursor-pointer active:scale-95 bg-slate-900/80 shrink-0"
                title="アバター変更"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[10px] hidden min-[400px]:inline whitespace-nowrap">キャラ</span>
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
          </>
        }
      />

      {/* 🖥️ PC・タブレット用マルチプレイヤーバー (ヘッダー下の右側に整然と配置) */}
      <div
        className="hidden sm:flex absolute top-[68px] right-4 z-40 items-center gap-2 pointer-events-auto"
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsPortalOpen(true)}
          className="glass-panel px-3 py-1.5 rounded-2xl flex items-center gap-1.5 border border-cyan-400/40 text-xs shadow-lg transition-all cursor-pointer bg-slate-950/80 hover:border-cyan-300 backdrop-blur-md active:scale-95"
          title={`ルーム: ${multiplayerManager.roomId} (${multiplayerManager.isHost ? 'ホスト' : 'クライアント'}) - クリックでQRコード表示`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              remotePlayers.length > 0
                ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                : 'bg-cyan-400'
            }`}
          />
          <span className="font-extrabold text-[11px] text-white tracking-tight">
            {remotePlayers.length > 0
              ? `同期中 (${remotePlayers.length + 1}人)`
              : multiplayerManager.isHost
              ? 'ホスト待受中'
              : 'P2P接続中'}
          </span>
        </button>

        <button
          onClick={() => setIsPortalOpen(true)}
          className="glass-panel px-3 py-1.5 rounded-2xl flex items-center gap-1.5 border border-indigo-400/40 text-xs text-indigo-200 hover:text-white hover:border-indigo-400 shadow-lg hover:shadow-indigo-500/20 transition-all cursor-pointer bg-indigo-950/60 active:scale-95"
          title="スマホ接続・公開ポータル"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-xs">公開ポータル</span>
        </button>

        <button
          onClick={() => setIsFriendBookOpen(true)}
          className="glass-panel px-3 py-1.5 rounded-2xl flex items-center gap-1.5 border border-amber-400/40 text-xs text-amber-200 hover:text-white hover:border-amber-400 shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer bg-amber-950/50 active:scale-95"
          title="フレンド連絡帳を開く"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs">フレンド帳</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
            className="glass-panel px-3 py-1.5 rounded-2xl flex items-center gap-2 border border-white/15 text-xs text-slate-200 hover:text-white hover:border-cyan-400/50 shadow-lg transition-all cursor-pointer active:scale-95 bg-slate-900/80"
            title="アバター変更"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs">キャラ変更</span>
          </button>

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

      {/* Minecraft風 F3 デバッグ情報画面 (非表示時は完全アンマウントしCPU負荷ゼロ) */}
      {isF3Open && <DebugOverlayF3 isOpen={isF3Open} />}

      {/* コンテキストUI (オブジェクト選択時) */}
      <ObjectContextMenu />

      {/* アセット配置バー */}
      <AssetPaletteBar isVisible={isPaletteOpen} />

      {/* 🎒 Minecraft風 クリエイティブインベントリ画面 (Eキーで開閉) */}
      <InventoryModal />

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

      {/* 🤝 友達からの招待アクセス検知バナー */}
      {incomingFriend && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl glass-panel border border-amber-400/60 bg-amber-950/90 text-amber-100 text-xs font-medium flex items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            🎉 <strong className="text-white">{incomingFriend.name}</strong> さんの家に遊びに来ました！
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={async () => {
                await FriendStorage.saveFriend({
                  id: `f_${Date.now()}`,
                  name: incomingFriend.name,
                  assetId: 'character_student',
                  houseId: incomingFriend.houseId,
                  roomId: incomingFriend.roomId,
                  lastVisitedAt: Date.now(),
                });
                setIncomingFriend(null);
                showNotification(`「${incomingFriend.name}」さんをフレンド登録しました！`);
              }}
              className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all active:scale-95 cursor-pointer"
            >
              フレンド登録
            </button>
            <button
              onClick={() => setIncomingFriend(null)}
              className="px-2 py-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

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
                <span className="text-amber-300">ランボルギーニ</span>
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
              <span className="text-amber-300">{nearbyVehicle.name.replace('黄色い', '')}</span>
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

      {/* 📖 フレンド連絡帳モーダル */}
      <FriendBookModal isOpen={isFriendBookOpen} onClose={() => setIsFriendBookOpen(false)} />

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
