import os
import asyncio
import logging
from pymongo import MongoClient
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler

# --- CONFIG ---
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/motarilog")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

# --- DB CONNECTION ---
client = MongoClient(MONGO_URI)
db = client.get_database()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /start <token>
    """
    chat_id = update.effective_chat.id
    args = context.args

    # 1. Check if token was passed (Deep Link)
    if not args:
        await context.bot.send_message(chat_id=chat_id, text="Hi! Please use the 'Connect Telegram' button on your MotariLog dashboard to link your account.")
        return

    token = args[0]
    
    # 2. Find user with this linking token
    user = db.users.find_one({"telegram_link_token": token})
    
    if user:
        # 3. Link Chat ID & Remove Token
        db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"telegram_chat_id": str(chat_id)},
                "$unset": {"telegram_link_token": ""}
            }
        )
        await context.bot.send_message(chat_id=chat_id, text=f"✅ **Connected!**\nHello {user.get('full_name', 'Driver')}.\n\nYou will now receive 2FA codes and alerts here.")
        print(f"✅ Linked user {user.get('email')} to chat {chat_id}")
    else:
        await context.bot.send_message(chat_id=chat_id, text="❌ Invalid or expired link. Please go back to the dashboard and try again.")

if __name__ == '__main__':
    if not BOT_TOKEN:
        print("Error: TELEGRAM_BOT_TOKEN is missing.")
        exit(1)
        
    print("🤖 Telegram Bot Started...")
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    
    start_handler = CommandHandler('start', start)
    application.add_handler(start_handler)
    
    application.run_polling()
