import 'dotenv/config';

// タイムゾーンを明示的に設定（cronスケジュールとDate処理のため）
process.env.TZ = process.env.TIMEZONE || 'Asia/Tokyo';

import { startBot, stopBot } from './services/discordBot.js';
import { startScheduler, stopScheduler } from './services/taskScheduler.js';
import { testConnection } from './services/chatworkClient.js';
import { archiveExpiredTasks } from './utils/taskManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * アプリケーションのメインエントリーポイント
 */
async function main() {
  console.log('='.repeat(50));
  console.log('Discord-Chatwork タスク管理Bot 起動中...');
  console.log('='.repeat(50));

  // 環境変数のチェック
  if (!process.env.DISCORD_TOKEN) {
    console.error('エラー: DISCORD_TOKENが設定されていません');
    process.exit(1);
  }

  if (!process.env.CHATWORK_API_TOKEN) {
    console.error('エラー: CHATWORK_API_TOKENが設定されていません');
    process.exit(1);
  }

  if (!process.env.CHATWORK_ROOM_ID) {
    console.error('エラー: CHATWORK_ROOM_IDが設定されていません');
    process.exit(1);
  }

  // dataディレクトリの存在確認と作成
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    console.log('dataディレクトリを作成しています...');
    await fs.mkdir(dataDir, { recursive: true });
  }

  // tasks.jsonの初期化
  const tasksFile = path.join(dataDir, 'tasks.json');
  try {
    await fs.access(tasksFile);
  } catch {
    console.log('tasks.jsonを初期化しています...');
    await fs.writeFile(tasksFile, JSON.stringify({ tasks: [] }, null, 2));
  }

  // Chatwork接続テスト
  console.log('\nChatwork接続テスト中...');
  const chatworkOk = await testConnection();
  if (!chatworkOk) {
    console.warn('警告: Chatworkへの接続に失敗しました。トークンとルームIDを確認してください。');
  }

  // 期限切れタスクのアーカイブ
  console.log('\n期限切れタスクをアーカイブ中...');
  const archivedCount = await archiveExpiredTasks();
  console.log(`${archivedCount}件のタスクをアーカイブしました`);

  // Discord Bot起動
  console.log('\nDiscord Bot起動中...');
  try {
    await startBot();
  } catch (error) {
    console.error('Discord Bot起動エラー:', error);
    process.exit(1);
  }

  // スケジューラー起動
  console.log('\nスケジューラー起動中...');
  startScheduler();

  console.log('\n' + '='.repeat(50));
  console.log('✅ すべてのサービスが正常に起動しました');
  console.log('='.repeat(50));
  console.log('\nDiscordでタスクを登録できます。');
  console.log('終了するには Ctrl+C を押してください。');
}

/**
 * グレースフルシャットダウン
 */
async function shutdown(signal) {
  console.log(`\n${signal}を受信しました。シャットダウン中...`);

  try {
    stopScheduler();
    await stopBot();
    console.log('すべてのサービスを停止しました');
    process.exit(0);
  } catch (error) {
    console.error('シャットダウンエラー:', error);
    process.exit(1);
  }
}

// シグナルハンドラーの設定
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// 未処理のエラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('未処理のPromise拒否:', error);
});

process.on('uncaughtException', (error) => {
  console.error('未処理の例外:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

// アプリケーション起動
main().catch((error) => {
  console.error('起動エラー:', error);
  process.exit(1);
});
