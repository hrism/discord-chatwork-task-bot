import { Client, GatewayIntentBits } from 'discord.js';
import { addTask, getAllTasks, getTodayTasks, getTaskByShortId, completeTask, deleteTask, formatTaskList, updateTaskDeadline } from '../utils/taskManager.js';
import { sendMessage, formatUrgentNotification } from './chatworkClient.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * Discord Botを起動
 */
export async function startBot() {
  return new Promise((resolve, reject) => {
    client.once('ready', () => {
      console.log(`Discord Botにログインしました: ${client.user.tag}`);
      resolve(client);
    });

    client.on('error', (error) => {
      console.error('Discord接続エラー:', error);
    });

    client.on('messageCreate', handleMessage);

    client.login(process.env.DISCORD_TOKEN).catch(reject);
  });
}

/**
 * メッセージハンドラー
 * @param {Message} message - Discordメッセージ
 */
async function handleMessage(message) {
  // Bot自身のメッセージは無視
  if (message.author.bot) return;

  const content = message.content.trim();

  try {
    // コマンドの処理
    if (content === 'リスト' || content === '一覧') {
      await handleListCommand(message);
    } else if (content === '今日') {
      await handleTodayCommand(message);
    } else if (content === 'ヘルプ' || content === 'help') {
      await handleHelpCommand(message);
    } else if (/削除/.test(content) && /[a-f0-9]{8}/i.test(content)) {
      // IDが含まれる場合のみ削除コマンドとして処理
      await handleDeleteCommand(message, content);
    } else if (/完了/.test(content) && /[a-f0-9]{8}/i.test(content)) {
      // IDが含まれる場合のみ完了コマンドとして処理
      await handleCompleteCommand(message, content);
    } else if (/変更/.test(content) && /[a-f0-9]{8}/i.test(content)) {
      // IDが含まれる場合のみ変更コマンドとして処理
      await handleUpdateCommand(message, content);
    } else {
      // タスク登録
      await handleAddTask(message, content);
    }
  } catch (error) {
    console.error('メッセージ処理エラー:', error);
    await message.reply('エラーが発生しました。もう一度お試しください。');
  }
}

/**
 * タスク一覧表示
 */
async function handleListCommand(message) {
  const tasks = await getAllTasks('pending');
  const sortedTasks = tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const formatted = formatTaskList(sortedTasks);

  await message.reply(`**タスク一覧**\n\`\`\`\n${formatted}\n\`\`\``);
}

/**
 * 今日のタスク表示
 */
async function handleTodayCommand(message) {
  const tasks = await getTodayTasks();
  const formatted = formatTaskList(tasks);

  await message.reply(`**今日のタスク**\n\`\`\`\n${formatted}\n\`\`\``);
}

/**
 * タスク削除
 */
async function handleDeleteCommand(message, content) {
  const idMatch = content.match(/[a-f0-9]{8}/i);
  if (!idMatch) {
    await message.reply('使い方: `削除 [ID]` または `[ID]削除`\nIDはリスト表示時の[]内の文字列です');
    return;
  }

  const shortId = idMatch[0];
  const task = await getTaskByShortId(shortId);

  if (!task) {
    await message.reply('指定されたIDのタスクが見つかりません。');
    return;
  }

  const deleted = await deleteTask(task.id);
  if (deleted) {
    await message.reply(`✅ タスクを削除しました: ${task.title}`);
  } else {
    await message.reply('タスクの削除に失敗しました。');
  }
}

/**
 * タスク完了
 */
async function handleCompleteCommand(message, content) {
  const idMatch = content.match(/[a-f0-9]{8}/i);
  if (!idMatch) {
    await message.reply('使い方: `完了 [ID]` または `[ID]完了`\nIDはリスト表示時の[]内の文字列です');
    return;
  }

  const shortId = idMatch[0];
  const task = await getTaskByShortId(shortId);

  if (!task) {
    await message.reply('指定されたIDのタスクが見つかりません。');
    return;
  }

  const completed = await completeTask(task.id);
  if (completed) {
    await message.reply(`✅ タスクを完了しました: ${task.title}`);
  } else {
    await message.reply('タスクの完了処理に失敗しました。');
  }
}

/**
 * ヘルプ表示
 */
async function handleHelpCommand(message) {
  const helpText = `
**Discord タスク管理Bot - 使い方**

📝 **タスク登録**
自然言語でタスクを入力してください。
例:
- 明日レポート提出
- 3日後に会議
- 来週月曜に資料作成
- 今週金曜15時に打ち合わせ
- 月末までに請求書

📋 **コマンド**
\`リスト\` または \`一覧\` - 全タスクを表示
\`今日\` - 今日期限のタスクを表示
\`削除 [ID]\` - タスクを削除
\`完了 [ID]\` - タスクを完了にする
\`[ID] 10/25\` または \`[ID]を明日に変更\` - タスクの期限を変更
\`ヘルプ\` - このヘルプを表示

🔔 **通知**
- タスク登録時: 即時通知
- 毎朝8時: 今日と3日以内のタスク
- 期限1時間前: 個別タスク通知
  `;

  await message.reply(helpText);
}

/**
 * タスク期限変更
 */
async function handleUpdateCommand(message, content) {
  const idMatch = content.match(/[a-f0-9]{8}/i);
  if (!idMatch) {
    await message.reply('使い方: `[ID] 10/25` または `[ID]を明日に変更`\nIDはリスト表示時の[]内の文字列です');
    return;
  }

  const shortId = idMatch[0];
  const task = await getTaskByShortId(shortId);

  if (!task) {
    await message.reply('指定されたIDのタスクが見つかりません。');
    return;
  }

  // ID以外の部分を日付テキストとして抽出
  const dateText = content.replace(shortId, '').replace(/変更|を|に/g, '').trim();

  if (!dateText) {
    await message.reply('新しい日付を指定してください。\n例: `' + shortId + ' 10/25` または `' + shortId + ' 明日`');
    return;
  }

  const updated = await updateTaskDeadline(task.id, dateText);
  if (updated) {
    await message.reply(`✅ タスクの期限を変更しました: ${updated.title}\n新しい期限: ${new Date(updated.deadline).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  } else {
    await message.reply('タスクの期限変更に失敗しました。');
  }
}

/**
 * タスク追加
 */
async function handleAddTask(message, content) {
  try {
    const task = await addTask(content, message.author.id);

    const shortId = task.id.substring(0, 8);

    let reply = `✅ タスクを登録しました!\n`;
    reply += `タスクID: ${shortId}\n`;
    reply += `タスク: ${task.title}\n`;
    reply += `期限: ${new Date(task.deadline).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

    await message.reply(reply);

    // すべてのタスクをChatworkに通知
    try {
      const chatworkMessage = formatUrgentNotification(task, shortId);
      await sendMessage(chatworkMessage);
      console.log('タスクをChatworkに通知しました');
    } catch (error) {
      console.error('Chatwork通知エラー:', error);
    }
  } catch (error) {
    console.error('タスク追加エラー:', error);
    await message.reply('タスクの登録に失敗しました。日付の形式を確認してください。');
  }
}

/**
 * Discord Botを停止
 */
export async function stopBot() {
  if (client) {
    await client.destroy();
    console.log('Discord Botを停止しました');
  }
}

/**
 * Bot接続状態を取得
 */
export function isReady() {
  return client?.isReady() ?? false;
}
