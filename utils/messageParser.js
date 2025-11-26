import { GoogleGenerativeAI } from '@google/generative-ai';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

/**
 * Gemini APIを使ってユーザーメッセージの意図を解析
 * @param {string} message - ユーザーのメッセージ
 * @returns {Promise<Object>} 解析結果 { action, taskId, content, deadline }
 */
export async function parseMessageIntent(message) {
  // Gemini APIキーが設定されていない場合はnullを返す
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    // 現在時刻を取得（Asia/Tokyo）
    const now = new Date();
    const jstNow = utcToZonedTime(now, 'Asia/Tokyo');
    const currentDateTime = format(jstNow, 'yyyy/MM/dd HH:mm:ss', { timeZone: 'Asia/Tokyo' });
    const currentYear = jstNow.getFullYear();

    // 明日の日付を計算（日本時間ベース）
    const tomorrow = new Date(jstNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

    // Geminiクライアントを初期化
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `あなたはタスク管理Botのメッセージ解析アシスタントです。
現在時刻: ${currentDateTime} (Asia/Tokyo)
現在の年: ${currentYear}

ユーザーのメッセージから以下の情報を抽出してJSON形式で返してください：

- action: ユーザーの意図（以下のいずれか）
  * "list": タスク一覧を表示
  * "today": 今日のタスクを表示
  * "help": ヘルプを表示
  * "complete": タスクを完了にする
  * "delete": タスクを削除
  * "edit": タスクの内容を編集（**必ずタスクIDが含まれている場合のみ**）
  * "update": タスクの期限を変更（**必ずタスクIDが含まれている場合のみ**）
  * "add": 新しいタスクを追加（デフォルト）

- taskId: タスクID（8文字の英数字）が含まれる場合は抽出、なければnull
- searchQuery: タスク名で検索する場合のキーワード（「〇〇のタスクを完了」のような場合に〇〇を抽出）、なければnull
- content: 編集後のタスク内容、または新規タスクの内容（actionがeditまたはaddの場合）
- deadline: 期限の日時をISO 8601形式で（actionがupdateまたはaddの場合）。日時表現がない場合は指定日の23:59をデフォルトにする。

**重要なルール:**
1. 「edit」「update」アクションは、タスクIDが含まれている場合のみ使用すること
2. 「complete」「delete」アクションは、タスクIDまたはタスク名の言及がある場合に使用可能
3. 「〇〇のタスク完了」「〇〇を完了させて」のような表現は、action="complete"、searchQuery="〇〇"とすること
4. 「〇〇を削除して」「〇〇のタスク消して」のような表現は、action="delete"、searchQuery="〇〇"とすること
5. タスクIDなしで「修正」「変更」「編集」などの言葉が含まれていて、かつ明確な完了/削除の意図がない場合は、新しいタスクの内容として扱い、actionは"add"とすること
6. 「〜ではなく〜」のような表現は、タスクIDが明示されていない限り新規タスクの内容として扱うこと
7. タスクID形式: 8文字の16進数（例: be4bc269, a1b2c3d4）

deadlineは必ず完全な日時（年月日と時刻）をISO 8601形式（例: 2025-10-30T19:30:00+09:00）で返してください。
「明日の19:30」→ 明日の日付の19:30:00
「明日」→ 明日の23:59:00
「今日」→ 今日の23:59:00
「3日後の10時」→ 3日後の10:00:00
「11/3」→ 今年の11月3日の23:59:00（年が指定されていない場合は現在の年を使用）
「12/25期限」→ 今年の12月25日の23:59:00

必ずJSON形式のみを返してください。説明文は不要です。

例1: "be4bc269 編集 楽天CSV対応 https://example.com"
→ {"action":"edit","taskId":"be4bc269","content":"楽天CSV対応 https://example.com","deadline":null}

例2: "be4bc269を削除"
→ {"action":"delete","taskId":"be4bc269","content":null,"deadline":null}

例3: "be4bc269を明日の15時に変更"
→ {"action":"update","taskId":"be4bc269","content":null,"deadline":"${tomorrowStr}T15:00:00+09:00"}

例4: "明日の19:30 カシモwimax"
→ {"action":"add","taskId":null,"content":"カシモwimax","deadline":"${tomorrowStr}T19:30:00+09:00"}

例5: "明日レポート提出"
→ {"action":"add","taskId":null,"content":"レポート提出","deadline":"${tomorrowStr}T23:59:00+09:00"}

例6: "リスト"
→ {"action":"list","taskId":null,"content":null,"deadline":null}

例7: "11/3期限 サイトパフォーマンス施策表"
→ {"action":"add","taskId":null,"content":"サイトパフォーマンス施策表","deadline":"${currentYear}-11-03T23:59:00+09:00"}

例8: "マクサスプレミアではなくマクサス　ホリエモン六本木店なので、一旦そこだけロゴなど修正いただけたら嬉しいです🙇"
→ {"action":"add","taskId":null,"searchQuery":null,"content":"マクサスプレミアではなくマクサス　ホリエモン六本木店なので、一旦そこだけロゴなど修正いただけたら嬉しいです🙇","deadline":"${tomorrowStr}T23:59:00+09:00"}

例9: "電気代のタスク完了させといて"
→ {"action":"complete","taskId":null,"searchQuery":"電気代","content":null,"deadline":null}

例10: "レポートを完了"
→ {"action":"complete","taskId":null,"searchQuery":"レポート","content":null,"deadline":null}

例11: "会議のタスク削除して"
→ {"action":"delete","taskId":null,"searchQuery":"会議","content":null,"deadline":null}

ユーザーメッセージ: "${message}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // マークダウンのコードブロックを除去
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    // JSONをパース
    const parsed = JSON.parse(text);

    console.log('LLM解析結果:', parsed);

    return parsed;
  } catch (error) {
    console.error('メッセージ解析エラー:', error);
    return null;
  }
}
