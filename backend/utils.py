import os
import requests

def send_telegram_message(chat_id, text):
    """
    Sends a message to a specific Telegram Chat ID.
    Returns True if successful, False otherwise.
    """
    # Get token inside the function 
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    
    if not token or not chat_id:
        print("Error: Missing Token or Chat ID")
        return False
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        response = requests.post(url, json={"chat_id": chat_id, "text": text}, timeout=5)
        return response.ok
    except Exception as e:
        print(f"❌ Telegram Error: {e}")
        return False
