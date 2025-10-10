import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseJapaneseDate, formatJapaneseDate } from './dateParser.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks.json');
const BACKUP_FILE = path.join(__dirname, '..', 'data', 'tasks.backup.json');

/**
 * タスクファイルを読み込む
 * @returns {Promise<Object>}
 */
async function loadTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // ファイルが存在しない場合は初期構造を返す
    if (error.code === 'ENOENT') {
      return { tasks: [] };
    }

    // ファイル破損の場合はバックアップから復元
    console.error('タスクファイル読み込みエラー。バックアップから復元を試みます...');
    try {
      const backupData = await fs.readFile(BACKUP_FILE, 'utf-8');
      return JSON.parse(backupData);
    } catch (backupError) {
      console.error('バックアップファイルも読み込めませんでした。新規作成します。');
      return { tasks: [] };
    }
  }
}

/**
 * タスクファイルを保存
 * @param {Object} data - 保存するデータ
 */
async function saveTasks(data) {
  try {
    // バックアップを作成
    try {
      await fs.copyFile(TASKS_FILE, BACKUP_FILE);
    } catch (error) {
      // 初回はファイルが存在しないので無視
    }

    // 保存
    await fs.writeFile(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('タスク保存エラー:', error);
    throw error;
  }
}

/**
 * 新しいタスクを追加
 * @param {string} text - タスクの内容
 * @param {string} userId - Discord User ID
 * @returns {Promise<Object>} 作成されたタスク
 */
export async function addTask(text, userId) {
  const parsed = parseJapaneseDate(text);
  const data = await loadTasks();

  const newTask = {
    id: uuidv4(),
    title: parsed.title,
    deadline: parsed.date.toISOString(),
    priority: parsed.priority,
    status: 'pending',
    createdAt: new Date().toISOString(),
    createdBy: userId,
  };

  data.tasks.push(newTask);
  await saveTasks(data);

  return newTask;
}

/**
 * 全タスクを取得
 * @param {string} filterStatus - ステータスでフィルタ ('pending', 'completed', 'all')
 * @returns {Promise<Array>}
 */
export async function getAllTasks(filterStatus = 'all') {
  const data = await loadTasks();

  if (filterStatus === 'all') {
    return data.tasks;
  }

  return data.tasks.filter(task => task.status === filterStatus);
}

/**
 * 今日期限のタスクを取得
 * @returns {Promise<Array>}
 */
export async function getTodayTasks() {
  const data = await loadTasks();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return data.tasks.filter(task => {
    if (task.status !== 'pending') return false;
    const deadline = new Date(task.deadline);
    return deadline >= today && deadline < tomorrow;
  });
}

/**
 * 指定日数以内に期限のタスクを取得
 * @param {number} days - 日数
 * @returns {Promise<Array>}
 */
export async function getUpcomingTasks(days = 3) {
  const data = await loadTasks();
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days);

  return data.tasks.filter(task => {
    if (task.status !== 'pending') return false;
    const deadline = new Date(task.deadline);
    return deadline >= now && deadline <= futureDate;
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

/**
 * タスクを完了にする
 * @param {string} taskId - タスクID
 * @returns {Promise<Object|null>}
 */
export async function completeTask(taskId) {
  const data = await loadTasks();
  const task = data.tasks.find(t => t.id === taskId);

  if (!task) {
    return null;
  }

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  await saveTasks(data);

  return task;
}

/**
 * タスクを削除
 * @param {string} taskId - タスクID
 * @returns {Promise<boolean>}
 */
export async function deleteTask(taskId) {
  const data = await loadTasks();
  const initialLength = data.tasks.length;
  data.tasks = data.tasks.filter(t => t.id !== taskId);

  if (data.tasks.length === initialLength) {
    return false;
  }

  await saveTasks(data);
  return true;
}

/**
 * 番号でタスクを検索（表示順）
 * @param {number} index - タスク番号（1から始まる）
 * @returns {Promise<Object|null>}
 */
export async function getTaskByIndex(index) {
  const data = await loadTasks();
  const pendingTasks = data.tasks.filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  if (index < 1 || index > pendingTasks.length) {
    return null;
  }

  return pendingTasks[index - 1];
}

/**
 * 期限切れタスクをアーカイブ
 * @returns {Promise<number>} アーカイブされたタスク数
 */
export async function archiveExpiredTasks() {
  const data = await loadTasks();
  const now = new Date();
  let archivedCount = 0;

  data.tasks = data.tasks.filter(task => {
    const deadline = new Date(task.deadline);
    const isExpired = deadline < now && task.status === 'pending';

    if (isExpired) {
      archivedCount++;
      return false;
    }
    return true;
  });

  if (archivedCount > 0) {
    await saveTasks(data);
  }

  return archivedCount;
}

/**
 * タスクをフォーマットして表示用文字列に変換
 * @param {Array} tasks - タスク配列
 * @returns {string}
 */
export function formatTaskList(tasks) {
  if (tasks.length === 0) {
    return 'タスクはありません。';
  }

  return tasks.map((task, index) => {
    const deadline = new Date(task.deadline);
    const priorityIcon = task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟡' : '⚪';
    const dateStr = formatJapaneseDate(deadline);
    return `${index + 1}. ${priorityIcon} ${task.title} (${dateStr})`;
  }).join('\n');
}
