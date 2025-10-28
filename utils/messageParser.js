import OpenAI from 'openai';

/**
 * OpenAI APIを使ってユーザーメッセージの意図を解析
 * @param {string} message - ユーザーのメッセージ
 * @returns {Promise<Object>} 解析結果 { action, taskId, content, dateText }
 */
export async function parseMessageIntent(message) {
  // OpenAI APIキーが設定されていない場合はnullを返す
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    // OpenAIクライアントを関数内で初期化
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはタスク管理Botのメッセージ解析アシスタントです。
ユーザーのメッセージから以下の情報を抽出してJSON形式で返してください：

- action: ユーザーの意図（以下のいずれか）
  * "list": タスク一覧を表示
  * "today": 今日のタスクを表示
  * "help": ヘルプを表示
  * "complete": タスクを完了にする
  * "delete": タスクを削除
  * "edit": タスクの内容を編集
  * "update": タスクの期限を変更
  * "add": 新しいタスクを追加（デフォルト）

- taskId: タスクID（8文字の英数字）が含まれる場合は抽出、なければnull
- content: 編集後のタスク内容、または新規タスクの内容（actionがeditまたはaddの場合）
- dateText: 期限の日付表現（actionがupdateまたはaddの場合）

必ずJSON形式のみを返してください。説明文は不要です。

例1: "be4bc269 編集 楽天CSV対応 https://example.com"
→ {"action":"edit","taskId":"be4bc269","content":"楽天CSV対応 https://example.com","dateText":null}

例2: "be4bc269のタスクにこのURLを追加: https://example.com"
→ {"action":"edit","taskId":"be4bc269","content":"このURLを追加: https://example.com","dateText":null}

例3: "be4bc269を削除"
→ {"action":"delete","taskId":"be4bc269","content":null,"dateText":null}

例4: "be4bc269を明日に変更"
→ {"action":"update","taskId":"be4bc269","content":null,"dateText":"明日"}

例5: "明日レポート提出"
→ {"action":"add","taskId":null,"content":"レポート提出","dateText":"明日"}

例6: "リスト"
→ {"action":"list","taskId":null,"content":null,"dateText":null}`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const result = response.choices[0].message.content.trim();

    // JSONをパース
    const parsed = JSON.parse(result);

    console.log('LLM解析結果:', parsed);

    return parsed;
  } catch (error) {
    console.error('メッセージ解析エラー:', error);
    return null;
  }
}
