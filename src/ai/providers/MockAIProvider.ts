import { IAIProvider, WorldEditContext, ProposedPlan } from '../IAIProvider';
import { IWorldCommand } from '../../core/types/command';
import { CreateObjectCommand, ChangeWeatherCommand, BatchCommand } from '../../core/commands/WorldCommands';
import { WorldEntity } from '../../core/types/world';

export class MockAIProvider implements IAIProvider {
  readonly id = 'mock-airas-ai';
  readonly name = 'Airas Local Brain (Mock)';

  async planWorldEdit(prompt: string, context: WorldEditContext): Promise<ProposedPlan> {
    // 擬似的な思考ディレイ (300ms)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const cleanPrompt = prompt.toLowerCase();
    const cursor = context.cursorPosition || { x: 260, y: 250 };
    const commands: IWorldCommand[] = [];
    const previewGhosts: Array<{ assetId: string; x: number; y: number; name: string }> = [];

    // 1. 自販機
    if (cleanPrompt.includes('自販機') || cleanPrompt.includes('自動販売機') || cleanPrompt.includes('vending')) {
      const entityId = `vending_ai_${Date.now()}`;
      const entity: WorldEntity = {
        id: entityId,
        assetId: 'vending_machine_retro',
        name: '昭和レトロ自販機 (AI生成)',
        type: 'object',
        position: { x: cursor.x, y: cursor.y, z: 0 },
      };
      commands.push(new CreateObjectCommand(entity));
      previewGhosts.push({
        assetId: 'vending_machine_retro',
        x: cursor.x,
        y: cursor.y,
        name: '昭和レトロ自販機',
      });
      return {
        title: '昭和レトロ自販機の配置',
        thought: 'ノスタルジックな雰囲気を演出するため、赤い瓶コーラ風の昭和レトロ自販機を指定位置に配置するコマンドを生成しました。',
        commands,
        previewGhostEntities: previewGhosts,
      };
    }

    // 2. ベンチ
    if (cleanPrompt.includes('ベンチ') || cleanPrompt.includes('bench') || cleanPrompt.includes('休憩')) {
      const entityId = `bench_ai_${Date.now()}`;
      const entity: WorldEntity = {
        id: entityId,
        assetId: 'retro_bench',
        name: '木製ベンチ (AI生成)',
        type: 'object',
        position: { x: cursor.x, y: cursor.y, z: 0 },
      };
      commands.push(new CreateObjectCommand(entity));
      previewGhosts.push({
        assetId: 'retro_bench',
        x: cursor.x,
        y: cursor.y,
        name: '木製ベンチ',
      });
      return {
        title: '木製ベンチの設置',
        thought: '歩行者やNPCがひと休みできるよう、歩道沿いに木製レトロベンチを設置します。',
        commands,
        previewGhostEntities: previewGhosts,
      };
    }

    // 3. 電柱
    if (cleanPrompt.includes('電柱') || cleanPrompt.includes('pole')) {
      const entityId = `pole_ai_${Date.now()}`;
      const entity: WorldEntity = {
        id: entityId,
        assetId: 'telegraph_pole',
        name: '木造電柱 (AI生成)',
        type: 'object',
        position: { x: cursor.x, y: cursor.y, z: 0 },
      };
      commands.push(new CreateObjectCommand(entity));
      previewGhosts.push({
        assetId: 'telegraph_pole',
        x: cursor.x,
        y: cursor.y,
        name: '木造電柱',
      });
      return {
        title: '電柱の設置',
        thought: '昭和の街並みの象徴であるトランス付きの木造電柱を配置します。',
        commands,
        previewGhostEntities: previewGhosts,
      };
    }

    // 4. 街灯
    if (cleanPrompt.includes('街灯') || cleanPrompt.includes('灯') || cleanPrompt.includes('lamp')) {
      const entityId = `lamp_ai_${Date.now()}`;
      const entity: WorldEntity = {
        id: entityId,
        assetId: 'street_lamp_warm',
        name: 'ノスタルジック街灯 (AI生成)',
        type: 'object',
        position: { x: cursor.x, y: cursor.y, z: 0 },
      };
      commands.push(new CreateObjectCommand(entity));
      previewGhosts.push({
        assetId: 'street_lamp_warm',
        x: cursor.x,
        y: cursor.y,
        name: 'ノスタルジック街灯',
      });
      return {
        title: '街灯の設置',
        thought: '夜間や夕暮れに温かいオレンジ色の光を投げかける街灯を設置します。',
        commands,
        previewGhostEntities: previewGhosts,
      };
    }

    // 5. 木・緑
    if (cleanPrompt.includes('木') || cleanPrompt.includes('緑') || cleanPrompt.includes('tree')) {
      const entityId = `tree_ai_${Date.now()}`;
      const entity: WorldEntity = {
        id: entityId,
        assetId: 'retro_tree',
        name: 'ケヤキの木 (AI生成)',
        type: 'object',
        position: { x: cursor.x, y: cursor.y, z: 0 },
      };
      commands.push(new CreateObjectCommand(entity));
      previewGhosts.push({
        assetId: 'retro_tree',
        x: cursor.x,
        y: cursor.y,
        name: 'ケヤキの木',
      });
      return {
        title: '街路樹の植樹',
        thought: '街に自然の温もりを加えるため、ふんわりとしたドット絵のケヤキの木を植樹します。',
        commands,
        previewGhostEntities: previewGhosts,
      };
    }

    // 6. NPC
    if (cleanPrompt.includes('npc') || cleanPrompt.includes('人') || cleanPrompt.includes('生徒') || cleanPrompt.includes('女の子')) {
      const entityId = `npc_ai_${Date.now()}`;
      const entity: WorldEntity = {
        id: entityId,
        assetId: 'character_schoolgirl',
        name: '女子生徒（AI生成）',
        type: 'npc',
        position: { x: cursor.x, y: cursor.y, z: 0 },
      };
      commands.push(new CreateObjectCommand(entity));
      previewGhosts.push({
        assetId: 'character_schoolgirl',
        x: cursor.x,
        y: cursor.y,
        name: '女子生徒NPC',
      });
      return {
        title: 'NPCの追加',
        thought: '街を行き交う黒髪セーラー服の女子生徒NPCを歩道に配置します。',
        commands,
        previewGhostEntities: previewGhosts,
      };
    }

    // 7. 天候: 雨
    if (cleanPrompt.includes('雨') || cleanPrompt.includes('rain')) {
      commands.push(new ChangeWeatherCommand('rain'));
      return {
        title: '天候を「雨」に変更',
        thought: 'ノスタルジックな雨降りの昭和風景へ天候を切り替えます。',
        commands,
      };
    }

    // 8. 天候: 雪
    if (cleanPrompt.includes('雪') || cleanPrompt.includes('snow')) {
      commands.push(new ChangeWeatherCommand('snow'));
      return {
        title: '天候を「雪」に変更',
        thought: '静かに雪が降り積もる冬の情景に変化させます。',
        commands,
      };
    }

    // 9. 天候: 晴れ
    if (cleanPrompt.includes('晴') || cleanPrompt.includes('clear')) {
      commands.push(new ChangeWeatherCommand('clear'));
      return {
        title: '天候を「快晴」に変更',
        thought: '青空が広がる明るい天候へ戻します。',
        commands,
      };
    }

    // 10. 天候: 夕暮れ・夕焼け
    if (cleanPrompt.includes('夕') || cleanPrompt.includes('sunset')) {
      commands.push(new ChangeWeatherCommand('sunset'));
      return {
        title: '天候を「夕暮れ」に変更',
        thought: '哀愁漂う美しいオレンジの夕焼け空に切り替えます。',
        commands,
      };
    }

    // 11. 複合: 昭和レトロな商店街・駅前エリアの一括生成
    if (cleanPrompt.includes('商店街') || cleanPrompt.includes('駅前') || cleanPrompt.includes('街') || cleanPrompt.includes('賑やか')) {
      const subCommands: IWorldCommand[] = [];
      const items = [
        { assetId: 'station_sign', x: cursor.x - 120, y: cursor.y - 40, name: '駅名標' },
        { assetId: 'vending_machine_retro', x: cursor.x - 50, y: cursor.y - 30, name: '赤い自販機' },
        { assetId: 'telegraph_pole', x: cursor.x + 30, y: cursor.y - 30, name: '電柱' },
        { assetId: 'retro_bench', x: cursor.x + 100, y: cursor.y + 20, name: '木製ベンチ' },
        { assetId: 'street_lamp_warm', x: cursor.x + 160, y: cursor.y - 30, name: '街灯' },
        { assetId: 'character_schoolgirl', x: cursor.x + 70, y: cursor.y + 25, name: '女子生徒' },
      ];

      for (const it of items) {
        const entity: WorldEntity = {
          id: `batch_${it.assetId}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          assetId: it.assetId,
          name: `${it.name} (AI)`,
          type: it.assetId.includes('character') ? 'npc' : 'object',
          position: { x: it.x, y: it.y, z: 0 },
        };
        subCommands.push(new CreateObjectCommand(entity));
        previewGhosts.push({
          assetId: it.assetId,
          x: it.x,
          y: it.y,
          name: it.name,
        });
      }

      const batchCmd = new BatchCommand('昭和レトロ駅前商店街セットの生成', subCommands);
      return {
        title: '昭和レトロ駅前商店街セットの生成',
        thought: '駅名標、赤い自販機、電柱、街灯、ベンチ、NPCを組み合わせた昭和ノスタルジックな景観セットを一括生成します。',
        commands: [batchCmd],
        previewGhostEntities: previewGhosts,
      };
    }

    // デフォルト: 赤い自販機をカーソル位置に配置するフォールバック提案
    const fallbackId = `vending_fallback_${Date.now()}`;
    const fallbackEntity: WorldEntity = {
      id: fallbackId,
      assetId: 'vending_machine_retro',
      name: '昭和レトロ自販機',
      type: 'object',
      position: { x: cursor.x, y: cursor.y, z: 0 },
    };
    commands.push(new CreateObjectCommand(fallbackEntity));
    previewGhosts.push({
      assetId: 'vending_machine_retro',
      x: cursor.x,
      y: cursor.y,
      name: '昭和レトロ自販機',
    });

    return {
      title: `「${prompt}」に基づくオブジェクト配置`,
      thought: `「${prompt}」の意図を解析し、最適な昭和レトロ家具として自販機を提案します。`,
      commands,
      previewGhostEntities: previewGhosts,
    };
  }
}
