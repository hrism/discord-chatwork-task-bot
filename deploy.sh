#!/bin/bash

# Lightsailデプロイスクリプト
set -e

INSTANCE_IP="18.181.165.151"
SSH_KEY="/tmp/discord-bot-key.pem"
REMOTE_USER="bitnami"
REPO_URL="git@github.com:hrism/discord-chatwork-task-bot.git"
APP_DIR="discord-chatwork-task-bot"

echo "=== Discord Chatwork Bot デプロイ開始 ==="

# SSH接続テスト
echo "1. SSH接続テスト..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" "echo 'SSH接続成功'"

# Gitリポジトリをクローン
echo "2. リポジトリをクローン..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << 'EOF'
if [ -d discord-chatwork-task-bot ]; then
  echo "既存のディレクトリを削除"
  rm -rf discord-chatwork-task-bot
fi
git clone https://github.com/hrism/discord-chatwork-task-bot.git
EOF

# .envファイルをアップロード
echo "3. 環境変数ファイルをアップロード..."
scp -i "$SSH_KEY" .env "$REMOTE_USER@$INSTANCE_IP:~/$APP_DIR/.env"

# 依存関係をインストール
echo "4. 依存関係をインストール..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << EOF
cd $APP_DIR
npm install --production
EOF

# PM2をインストールして起動
echo "5. PM2で起動..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << 'EOF'
# PM2をグローバルにインストール（なければ）
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

cd discord-chatwork-task-bot

# 既存のプロセスを停止
pm2 delete discord-bot 2>/dev/null || true

# Botを起動
pm2 start index.js --name discord-bot

# 自動起動設定
pm2 startup systemd -u bitnami --hp /home/bitnami
pm2 save

# ステータス確認
pm2 status
EOF

echo ""
echo "=== デプロイ完了 ==="
echo "インスタンスIP: $INSTANCE_IP"
echo "ステータス確認: ssh -i $SSH_KEY $REMOTE_USER@$INSTANCE_IP 'pm2 status'"
echo "ログ確認: ssh -i $SSH_KEY $REMOTE_USER@$INSTANCE_IP 'pm2 logs discord-bot'"
