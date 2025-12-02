from flask import Blueprint, request, jsonify, session
import bcrypt
from marshmallow import ValidationError
from datetime import datetime
from bson.objectid import ObjectId
from marshmallow.fields import Method
from backend.models import db, user_schema

# Create the Blueprint
auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/register', methods=['POST'])
def register_user():
    # 1. Get the JSON data
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400

    # 2. Validate Input
    try:
        validated_data = user_schema.load(data)
    except ValidationError as err:
        return jsonify(err.messages), 400

    # 3. Check for Existing Email
    email = validated_data['email']
    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 409

    # 4. Hash the Password
    password = validated_data['password_hash']
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # 5. Create User Document
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

    # 6. Insert into Database
    try:
        result = db.users.insert_one(new_user)
        created_user = db.users.find_one({"_id": result.inserted_id})
        return jsonify(user_schema.dump(created_user)), 201
    except Exception as e:
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login_user():
    # 1. Get request data
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

    return jsonify({
        "message": "Login successful",
        "user": user_schema.dump(user)
    }), 200

# ---------------------------------------------------------
# Route: Logout User
# ---------------------------------------------------------
@auth_bp.route('/logout', methods=['POST'])
def logout_user():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200





# ---------------------------------------------------------
# Route: Get User Profile
# ---------------------------------------------------------

@auth_bp.route('/profile', methods=['GET'])
def get_profile():
    # 1. Check Authentication
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # 2. Retrieve User
    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # 3. Return Data (Schema handles hiding password_hash)
        return jsonify(user_schema.dump(user)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500





# ---------------------------------------------------------
# Route: Update User Profile
# ---------------------------------------------------------
@auth_bp.route('/profile', methods=['PUT'])
def update_profile():
    # 1. Check Authentication
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # 2. Get Input Data
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data"}), 400

    # 3. Filter Allowed Fields
    # Security: Only allow updating specific fields. 
    # Prevent changing 'role', 'email', or 'password' here.
    allowed_fields = ['full_name', 'phone_number', 'telegram_chat_id']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400

    # 4. Update Database
    try:
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )

        # 5. Return Updated Profile
        updated_user = db.users.find_one({"_id": ObjectId(user_id)})
        return jsonify(user_schema.dump(updated_user)), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
