import os
import random
import uuid
import requests
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session
from backend.models import db, user_schema
from bson.objectid import ObjectId
import bcrypt

# IMPORTANT: Import the sender from utils to avoid circular import crashes
from backend.utils import send_telegram_message

auth_bp = Blueprint('auth_bp', __name__)

# ---------------------------------------------------------
# 1. REGISTER
# ---------------------------------------------------------
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validation
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    email = data['email'].strip().lower()
    
    # Check if user exists
    if db.users.find_one({'email': email}):
        return jsonify({'error': 'Email already registered'}), 409

    # Hash Password
    hashed_pw = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    
    # Create User Object
    new_user = {
        "full_name": data.get('full_name'),
        "email": email,
        "password_hash": hashed_pw.decode('utf-8'),
        "phone_number": data.get('phone_number'),
        "role": "user",
        "created_at": datetime.utcnow(),
        "telegram_chat_id": None 
    }
    
    try:
        db.users.insert_one(new_user)
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# 2. LOGIN (With 2FA Logic)
# ---------------------------------------------------------
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = db.users.find_one({"email": email})

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        
        # Check if Telegram is Linked
        chat_id = user.get('telegram_chat_id')
        
        if chat_id:
            # --- START 2FA FLOW ---
            otp = str(random.randint(100000, 999999))
            
            # Save OTP to DB (Valid for 5 mins)
            db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "otp_code": otp,
                    "otp_expiry": datetime.utcnow() + timedelta(minutes=5)
                }}
            )
            
            # Send Code via Utility
            msg = f"🔐 *MotariLog Login*\n\nYour verification code is: `{otp}`\n\n(Valid for 5 minutes)"
            sent = send_telegram_message(chat_id, msg)
            
            if sent:
                # Store user ID temporarily (pending verification)
                session['pending_2fa_user_id'] = str(user['_id'])
                
                # Return 202 to tell frontend to show the popup
                return jsonify({
                    "status": "2fa_required",
                    "message": "Verification code sent to Telegram"
                }), 202
            
            # If sending failed, just log it and allow normal login
            print("❌ Failed to send Telegram 2FA. Logging in normally.")

        # --- NORMAL LOGIN ---
        session['user_id'] = str(user['_id'])
        return jsonify({
            "message": "Login successful", 
            "user": user_schema.dump(user)
        }), 200

    return jsonify({"error": "Invalid email or password"}), 401

# ---------------------------------------------------------
# 3. VERIFY 2FA CODE
# ---------------------------------------------------------
@auth_bp.route('/verify-2fa', methods=['POST'])
def verify_2fa():
    # Get the user waiting in the holding area
    pending_user_id = session.get('pending_2fa_user_id')
    
    if not pending_user_id:
        return jsonify({"error": "Session expired. Please login again."}), 401
        
    data = request.get_json()
    user_code = data.get('code')
    
    user = db.users.find_one({"_id": ObjectId(pending_user_id)})
    
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    saved_code = user.get('otp_code')
    expiry = user.get('otp_expiry')
    
    # Validations
    if not saved_code or not expiry:
        return jsonify({"error": "No active code found."}), 400
        
    if datetime.utcnow() > expiry:
        return jsonify({"error": "Code expired. Please login again."}), 400
        
    if user_code == saved_code:
        # --- SUCCESS ---
        # 1. Clean up DB
        db.users.update_one({"_id": user["_id"]}, {"$unset": {"otp_code": "", "otp_expiry": ""}})
        
        # 2. Promote session to fully logged in
        session.pop('pending_2fa_user_id', None)
        session['user_id'] = str(user['_id'])
        
        return jsonify({
            "message": "Login verified",
            "user": user_schema.dump(user)
        }), 200
    else:
        return jsonify({"error": "Invalid code"}), 400

# ---------------------------------------------------------
# 4. LOGOUT
# ---------------------------------------------------------
@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'}), 200

# ---------------------------------------------------------
# 5. PROFILE (For checking Telegram status)
# ---------------------------------------------------------
@auth_bp.route('/profile', methods=['GET'])
def profile():
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user: return jsonify({'error': 'User not found'}), 404
    
    user_data = user_schema.dump(user)
    # Add flag so frontend knows to turn button green
    user_data['is_telegram_linked'] = bool(user.get('telegram_chat_id'))
    
    return jsonify(user_data), 200

# ---------------------------------------------------------
# 6. TELEGRAM: GENERATE LINK
# ---------------------------------------------------------
@auth_bp.route('/telegram/link', methods=['POST'])
def get_telegram_link():
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401

    # Generate random token
    token = uuid.uuid4().hex[:12]
    
    try:
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"telegram_link_token": token}}
        )
        
        # Replace 'motrilog_bot' with your ACTUAL bot username if different
        bot_username = "motrilog_bot"
        
        return jsonify({
            'link': f"https://t.me/{bot_username}?start={token}",
            'token': token
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# 7. TELEGRAM: UNLINK
# ---------------------------------------------------------
@auth_bp.route('/telegram/unlink', methods=['POST'])
def unlink_telegram():
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$unset": {"telegram_chat_id": ""}}
        )
        return jsonify({'message': 'Unlinked successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# 8. TELEGRAM: TEST ALERT (Optional)
# ---------------------------------------------------------
@auth_bp.route('/telegram/test-alert', methods=['POST'])
def test_telegram_alert():
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    
    user = db.users.find_one({"_id": ObjectId(user_id)})
    chat_id = user.get('telegram_chat_id')
    
    if not chat_id:
        return jsonify({'error': 'Telegram not linked'}), 400
        
    msg = "🔔 **Test Notification**\n\nThis confirms your MotariLog alerts are working!"
    sent = send_telegram_message(chat_id, msg)
    
    if sent:
        return jsonify({'message': 'Test message sent!'}), 200
    else:
        return jsonify({'error': 'Failed to send. Check bot token.'}), 500
