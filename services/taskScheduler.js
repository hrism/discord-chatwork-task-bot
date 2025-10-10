import cron from 'node-cron';
import { getTodayTasks, getUpcomingTasks, getAllTasks } from '../utils/taskManager.js';
import { sendMessage, formatDailyNotification, formatDeadlineNotification } from './chatworkClient.js';

let scheduledJobs = [];

/**
 * 定期通知スケジューラーを開始
 */
export function startScheduler() {
  const morningHour = parseInt(process.env.MORNING_NOTIFY_HOUR || '8', 10);

  // 毎朝8時（または設定された時刻）に定期通知
  const morningJob = cron.schedule(`0 ${morningHour} * * *`, async () => {
    console.log('定期通知を送信中...');
    try {
      const todayTasks = await getTodayTasks();
      const upcomingTasks = await getUpcomingTasks(3);
      const message = formatDailyNotification(todayTasks, upcomingTasks);
      await sendMessage(message);
      console.log('定期通知を送信しました');
    } catch (error) {
      console.error('定期通知の送信に失敗しました:', error.message);
    }
  });

  // 1時間ごとに期限1時間前のタスクをチェック
  const hourlyJob = cron.schedule('0 * * * *', async () => {
    console.log('期限通知をチェック中...');
    try {
      await checkDeadlineNotifications();
    } catch (error) {
      console.error('期限通知のチェックに失敗しました:', error.message);
    }
  });

  scheduledJobs.push(morningJob, hourlyJob);
  console.log('スケジューラーを起動しました');
  console.log(`- 定期通知: 毎日${morningHour}:00`);
  console.log('- 期限通知: 毎時チェック');
}

/**
 * 期限1時間前のタスクをチェックして通知
 */
async function checkDeadlineNotifications() {
  const allTasks = await getAllTasks('pending');
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const oneHourTenMinutesLater = new Date(now.getTime() + 70 * 60 * 1000);

  for (const task of allTasks) {
    const deadline = new Date(task.deadline);

    // 期限の1時間前〜1時間10分前の範囲内
    if (deadline > oneHourLater && deadline <= oneHourTenMinutesLater) {
      console.log(`期限通知を送信: ${task.title}`);
      try {
        const message = formatDeadlineNotification(task);
        await sendMessage(message);
      } catch (error) {
        console.error(`期限通知の送信に失敗: ${task.title}`, error.message);
      }
    }
  }
}

/**
 * スケジューラーを停止
 */
export function stopScheduler() {
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs = [];
  console.log('スケジューラーを停止しました');
}

/**
 * 即座に定期通知を送信（テスト用）
 */
export async function sendTestNotification() {
  console.log('テスト通知を送信中...');
  try {
    const todayTasks = await getTodayTasks();
    const upcomingTasks = await getUpcomingTasks(3);
    const message = formatDailyNotification(todayTasks, upcomingTasks);
    await sendMessage(message);
    console.log('テスト通知を送信しました');
    return true;
  } catch (error) {
    console.error('テスト通知の送信に失敗しました:', error.message);
    return false;
  }
}
