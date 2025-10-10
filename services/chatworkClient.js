import axios from 'axios';

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';
const API_TOKEN = process.env.CHATWORK_API_TOKEN;
const ROOM_ID = process.env.CHATWORK_ROOM_ID;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒

/**
 * Chatworkにメッセージを送信
 * @param {string} message - 送信するメッセージ
 * @param {number} retryCount - リトライ回数
 * @returns {Promise<Object>}
 */
export async function sendMessage(message, retryCount = 0) {
  try {
    const response = await axios.post(
      `${CHATWORK_API_BASE}/rooms/${ROOM_ID}/messages`,
      { body: message },
      {
        headers: {
          'X-ChatWorkToken': API_TOKEN,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Chatwork送信エラー (試行 ${retryCount + 1}/${MAX_RETRIES}):`, error.message);

    if (retryCount < MAX_RETRIES - 1) {
      console.log(`${RETRY_DELAY / 1000}秒後に再試行します...`);
      await sleep(RETRY_DELAY);
      return sendMessage(message, retryCount + 1);
    }

    throw new Error(`Chatwork送信失敗: ${error.message}`);
  }
}

/**
 * 定期通知メッセージをフォーマット
 * @param {Array} todayTasks - 今日期限のタスク
 * @param {Array} upcomingTasks - 3日以内のタスク
 * @returns {string}
 */
export function formatDailyNotification(todayTasks, upcomingTasks) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  let message = `[info][title]📋 タスク通知 - ${dateStr}[/title]\n`;

  // 今日期限のタスク
  if (todayTasks.length > 0) {
    message += '\n【今日期限のタスク】\n';
    todayTasks.forEach(task => {
      const deadline = new Date(task.deadline);
      const timeStr = `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`;
      message += `🔴 ${task.title} (${timeStr})\n`;
    });
  } else {
    message += '\n【今日期限のタスク】\nなし\n';
  }

  // 3日以内のタスク（今日を除く）
  const upcoming = upcomingTasks.filter(task => {
    const deadline = new Date(task.deadline);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return deadline >= today.setDate(today.getDate() + 1);
  });

  if (upcoming.length > 0) {
    message += '\n【3日以内のタスク】\n';
    upcoming.forEach(task => {
      const deadline = new Date(task.deadline);
      const dateStr = `${deadline.getMonth() + 1}/${deadline.getDate()}`;
      const timeStr = `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`;
      message += `🟡 ${task.title} (${dateStr} ${timeStr})\n`;
    });
  }

  message += '[/info]';
  return message;
}

/**
 * 新規タスク通知をフォーマット
 * @param {Object} task - タスク情報
 * @param {string} shortId - 短縮タスクID
 * @returns {string}
 */
export function formatUrgentNotification(task, shortId) {
  const deadline = new Date(task.deadline);
  const dateStr = `${deadline.getMonth() + 1}月${deadline.getDate()}日`;
  const timeStr = `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`;

  return `[info][title]📝 新規タスク登録[/title]\n` +
    `タスクID: ${shortId}\n` +
    `タスク: ${task.title}\n` +
    `期限: ${dateStr} ${timeStr}\n\n` +
    `完了する場合は、Discordで「完了 ${shortId}」または「${shortId}完了」と送信してください。\n[/info]`;
}

/**
 * 期限1時間前の通知をフォーマット
 * @param {Object} task - タスク情報
 * @returns {string}
 */
export function formatDeadlineNotification(task) {
  const deadline = new Date(task.deadline);
  const timeStr = `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`;

  return `[info][title]⏰ タスク期限通知[/title]\n` +
    `タスク: ${task.title}\n` +
    `期限: あと1時間 (${timeStr})\n[/info]`;
}

/**
 * スリープ関数
 * @param {number} ms - ミリ秒
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Chatwork API接続テスト
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  try {
    const response = await axios.get(
      `${CHATWORK_API_BASE}/me`,
      {
        headers: {
          'X-ChatWorkToken': API_TOKEN,
        },
      }
    );
    console.log('Chatwork接続成功:', response.data.name);
    return true;
  } catch (error) {
    console.error('Chatwork接続失敗:', error.message);
    return false;
  }
}
