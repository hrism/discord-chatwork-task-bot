import { Client, GatewayIntentBits } from 'discord.js';
import { addTask, getAllTasks, getTodayTasks, getTaskByShortId, completeTask, deleteTask, formatTaskList, updateTaskDeadline, updateTaskContent } from '../utils/taskManager.js';
import { sendMessage, formatUrgentNotification } from './chatworkClient.js';
import { formatJapaneseDate } from '../utils/dateParser.js';
import { parseMessageIntent } from '../utils/messageParser.js';

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
    // LLMで意図を解析（OPENAI_API_KEYが設定されている場合）
    const intent = await parseMessageIntent(content);

    if (intent) {
      console.log('LLMで解析されたメッセージ:', intent);

      // LLM解析結果に基づいて処理を分岐
      switch (intent.action) {
        case 'list':
          await handleListCommand(message);
          return;

        case 'today':
          await handleTodayCommand(message);
          return;

        case 'help':
          await handleHelpCommand(message);
          return;

        case 'delete':
          if (intent.taskId) {
            await handleDeleteCommandByLLM(message, intent.taskId);
          } else {
            await message.reply('削除するタスクのIDを指定してください。');
          }
          return;

        case 'complete':
          if (intent.taskId) {
            await handleCompleteCommandByLLM(message, intent.taskId);
          } else {
            await message.reply('完了するタスクのIDを指定してください。');
          }
          return;

        case 'edit':
          if (intent.taskId && intent.content) {
            await handleEditCommandByLLM(message, intent.taskId, intent.content);
          } else {
            await message.reply('編集するタスクのIDと新しい内容を指定してください。');
          }
          return;

        case 'update':
          if (intent.taskId && intent.deadline) {
            await handleUpdateCommandByLLM(message, intent.taskId, intent.deadline);
          } else {
            await message.reply('変更するタスクのIDと新しい期限を指定してください。');
          }
          return;

        case 'add':
        default:
          // タスク登録
          await handleAddTask(message, intent.content || content, intent.deadline);
          return;
      }
    }

    // LLM解析が利用できない場合はエラーを返す
    await message.reply('❌ OpenAI APIが設定されていないため、タスクの登録・変更ができません。\n環境変数 OPENAI_API_KEY を設定してください。');
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
\`[ID] 編集 新しい内容\` - タスクの内容を編集
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
    await message.reply(`✅ タスクの期限を変更しました: ${updated.title}\n新しい期限: ${formatJapaneseDate(new Date(updated.deadline))}`);
  } else {
    await message.reply('タスクの期限変更に失敗しました。');
  }
}

/**
 * タスク削除（LLM解析版）
 */
async function handleDeleteCommandByLLM(message, shortId) {
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
 * タスク完了（LLM解析版）
 */
async function handleCompleteCommandByLLM(message, shortId) {
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
 * タスク期限変更（LLM解析版）
 */
async function handleUpdateCommandByLLM(message, shortId, deadline) {
  const task = await getTaskByShortId(shortId);

  if (!task) {
    await message.reply('指定されたIDのタスクが見つかりません。');
    return;
  }

  const updated = await updateTaskDeadline(task.id, deadline);
  if (updated) {
    await message.reply(`✅ タスクの期限を変更しました: ${updated.title}\n新しい期限: ${formatJapaneseDate(new Date(updated.deadline))}`);
  } else {
    await message.reply('タスクの期限変更に失敗しました。');
  }
}

/**
 * タスク内容編集（LLM解析版）
 */
async function handleEditCommandByLLM(message, shortId, newContent) {
  const task = await getTaskByShortId(shortId);

  if (!task) {
    await message.reply('指定されたIDのタスクが見つかりません。');
    return;
  }

  const updated = await updateTaskContent(task.id, newContent);
  if (updated) {
    await message.reply(`✅ タスクの内容を編集しました!\n新しい内容: ${updated.title}\n期限: ${formatJapaneseDate(new Date(updated.deadline))}`);
  } else {
    await message.reply('タスクの編集に失敗しました。');
  }
}

/**
 * タスク内容編集
 */
async function handleEditCommand(message, content) {
  const idMatch = content.match(/[a-f0-9]{8}/i);
  if (!idMatch) {
    await message.reply('使い方: `[ID] 編集 新しい内容`\nIDはリスト表示時の[]内の文字列です');
    return;
  }

  const shortId = idMatch[0];
  const task = await getTaskByShortId(shortId);

  if (!task) {
    await message.reply('指定されたIDのタスクが見つかりません。');
    return;
  }

  // ID と「編集」の文字を除去して新しい内容を抽出
  const newContent = content.replace(shortId, '').replace(/編集/g, '').trim();

  if (!newContent) {
    await message.reply('新しいタスク内容を指定してください。\n例: `' + shortId + ' 編集 新しいタスク内容`');
    return;
  }

  const updated = await updateTaskContent(task.id, newContent);
  if (updated) {
    await message.reply(`✅ タスクの内容を編集しました!\n新しい内容: ${updated.title}\n期限: ${formatJapaneseDate(new Date(updated.deadline))}`);
  } else {
    await message.reply('タスクの編集に失敗しました。');
  }
}

/**
 * タスク追加
 */
async function handleAddTask(message, content, deadline = null) {
  try {
    const task = await addTask(content, message.author.id, deadline);

    const shortId = task.id.substring(0, 8);

    let reply = `✅ タスクを登録しました!\n`;
    reply += `タスクID: ${shortId}\n`;
    reply += `タスク: ${task.title}\n`;
    reply += `期限: ${formatJapaneseDate(new Date(task.deadline))}`;

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
