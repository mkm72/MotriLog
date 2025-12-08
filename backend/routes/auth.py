from flask import Blueprint, request, jsonify, session
import bcrypt
from marshmallow import ValidationError
from datetime import datetime
from bson.objectid import ObjectId
from backend.models import db, user_schema

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/register', methods=['POST'])
def register_user():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400

    try:
        validated_data = user_schema.load(data)
    except ValidationError as err:
        return jsonify(err.messages), 400

    email = validated_data['email']
    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 409

    password = validated_data['password_hash']
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    new_user = {
        "email": email,
        "password_hash": hashed_password.decode('utf-8'),
        "full_name": validated_data['full_name'],
        "phone_number": validated_data.get('phone_number'),
        "telegram_chat_id": validated_data.get('telegram_chat_id'),
        "role": validated_data.get('role', 'user'),
        "created_at": datetime.utcnow(),
        "is_active": True,
        "last_login": None
    }

    result = db.users.insert_one(new_user)
    created_user = db.users.find_one({"_id": result.inserted_id})
    return jsonify(user_schema.dump(created_user)), 201


@auth_bp.route('/login', methods=['POST'])
def login_user():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data"}), 400

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = db.users.find_one({"email": email})
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.get('is_active', True):
        return jsonify({"error": "Account is disabled"}), 401

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )

    session['user_id'] = str(user['_id'])
    session['role'] = user['role']
    session.permanent = True

    return jsonify({"message": "Login successful", "user": user_schema.dump(user)}), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route('/profile', methods=['GET'])
def get_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user_schema.dump(user)), 200


@auth_bp.route('/profile', methods=['PUT'])
def update_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data"}), 400

    allowed_fields = ['full_name', 'phone_number', 'telegram_chat_id']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    updated_user = db.users.find_one({"_id": ObjectId(user_id)})
    return jsonify(user_schema.dump(updated_user)), 200


# NEW — Check if user is logged in
@auth_bp.route('/check-auth', methods=['GET'])
def check_auth():
    if session.get("user_id"):
        return jsonify({"logged_in": True}), 200
    return jsonify({"logged_in": False}), 200
