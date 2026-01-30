#!/bin/bash

# Конфигурация
BACKUP_DIR="/root/AB/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="backup_$TIMESTAMP.sql.gz"
CONTAINER_NAME="realty-postgres"
DB_USER="realtyuser"
DB_NAME="realty_agency"

# Telegram настройки
TG_BOT_TOKEN="8099455576:AAFRK-pPFFBk_VOmuZQGudlPXpR40kX42FI"
TG_CHAT_ID="5261935873"

# Создаем папку если нет
mkdir -p $BACKUP_DIR

# 1. Создание дампа базы данных (сразу сжимаем)
echo "📦 Создаю бекап базы данных..."
docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/$FILENAME"

# Проверяем успешность
if [ $? -eq 0 ]; then
  echo "✅ Бекап создан: $FILENAME"
  
  # 2. Отправка в Telegram
  RESPONSE=$(curl -s -F chat_id=$TG_CHAT_ID \
       -F caption="📦 *Автоматический бекап базы данных*
📅 Дата: $(date +"%d.%m.%Y %H:%M")
💾 Файл: $FILENAME
✅ Статус: Успешно" \
       -F parse_mode="Markdown" \
       -F document=@"$BACKUP_DIR/$FILENAME" \
       https://api.telegram.org/bot$TG_BOT_TOKEN/sendDocument)
       
  echo "📤 Отправлено в Telegram"

  # 3. Удаление старых бекапов (старше 7 дней)
  find $BACKUP_DIR -type f -name "backup_*.sql.gz" -mtime +7 -delete
  echo "🧹 Старые бекапы очищены"
  
else
  echo "❌ Ошибка при создании бекапа!"
  # Уведомление об ошибке
  curl -s -X POST https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage \
       -d chat_id=$TG_CHAT_ID \
       -d text="❌ *Ошибка бекапа!* Не удалось создать резервную копию базы данных." \
       -d parse_mode="Markdown"
fi
