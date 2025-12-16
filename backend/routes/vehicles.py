from flask import Blueprint, request, jsonify, session, current_app
from bson.objectid import ObjectId
from datetime import datetime
from marshmallow import ValidationError
from backend.models import db, vehicle_schema, manufacturer_schema
import os
import uuid

from backend.services.prediction import prediction_engine

vehicles_bp = Blueprint('vehicles_bp', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------------------------------------------------
# Get All Manufacturers
# ---------------------------------------------------------
@vehicles_bp.route('/manufacturers', methods=['GET'])
def get_manufacturers():
    try:
        makers = list(db.manufacturers.find().sort("name", 1))
        return jsonify([manufacturer_schema.dump(m) for m in makers]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# Get User's Vehicles
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles', methods=['GET'])
def get_vehicles():
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    try:
        vehicles = list(db.vehicles.find({'user_id': ObjectId(user_id), 'is_active': True}))
        return jsonify([vehicle_schema.dump(v) for v in vehicles]), 200
    except Exception as e: return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# Add New Vehicle
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles', methods=['POST'])
def add_vehicle():
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    
    if request.content_type.startswith('multipart/form-data'):
        json_data = request.form.to_dict()
        for key, value in json_data.items():
            if value == "" or value == "null": json_data[key] = None
    else:
        json_data = request.get_json()

    if not json_data: return jsonify({'error': 'No input data'}), 400
    json_data['user_id'] = user_id
    
    try:
        data = vehicle_schema.load(json_data)
    except ValidationError as err:
        return jsonify(err.messages), 400
    
    existing = db.vehicles.find_one({'license_plate': data['license_plate']})
    if existing: return jsonify({'error': 'License plate already registered'}), 409

    # Image Upload
    image_db_path = None
    if 'image' in request.files:
        file = request.files['image']
        if file and allowed_file(file.filename):
            try:
                ext = file.filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4().hex}.{ext}"
                base_path = current_app.config['UPLOAD_FOLDER']
                os.makedirs(os.path.join(base_path, str(user_id)), exist_ok=True)
                file.save(os.path.join(base_path, str(user_id), unique_filename))
                image_db_path = f"{user_id}/{unique_filename}"
            except Exception as e: print(f"Image Error: {e}")

    # Create Document
    vehicle_doc = {
        'user_id': ObjectId(user_id),
        'manufacturer': data['manufacturer'],
        'model': data['model'],
        'year': data['year'],
        'color': data.get('color'),
        'license_plate': data['license_plate'],
        'vin': data.get('vin'),
        'purchase_date': data.get('purchase_date'),
        'initial_mileage': data['initial_mileage'],
        'current_mileage': data['current_mileage'],
        'image_filename': image_db_path,
        'last_mileage_update': datetime.utcnow(),
        'created_at': datetime.utcnow(),
        'is_active': True
    }
    
    try:
        result = db.vehicles.insert_one(vehicle_doc)
        new_id = result.inserted_id
        # Trigger Predictions
        prediction_engine.calculate_predictions(new_id)
        return jsonify({'message': 'Vehicle added', 'vehicle_id': str(new_id)}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# UPDATE VEHICLE 
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['PUT'])
def update_vehicle(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401

    # Handle FormData or JSON
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
    else:
        data = request.get_json() or {}

    # Define allowed fields to update
    allowed = ['license_plate', 'color', 'year', 'current_mileage', 'vin', 'manufacturer', 'model']
    update_data = {k: v for k, v in data.items() if k in allowed}

    # Handle Image Update
    if 'image' in request.files:
        file = request.files['image']
        if file and allowed_file(file.filename):
            try:
                ext = file.filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4().hex}.{ext}"
                base_path = current_app.config['UPLOAD_FOLDER']
                os.makedirs(os.path.join(base_path, str(user_id)), exist_ok=True)
                file.save(os.path.join(base_path, str(user_id), unique_filename))
                update_data['image_filename'] = f"{user_id}/{unique_filename}"
            except Exception as e: print(f"Image update failed: {e}")

    if not update_data and 'image' not in request.files:
        return jsonify({'error': 'No fields to update'}), 400

    try:
        db.vehicles.update_one(
            {'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        
        # Recalculate predictions if mileage changed
        if 'current_mileage' in update_data:
            prediction_engine.calculate_predictions(ObjectId(vehicle_id))

        return jsonify({'message': 'Vehicle updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# UPDATE MILEAGE
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>/mileage', methods=['PUT'])
def update_mileage(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    new_mileage = data.get('current_mileage')
    
    if new_mileage is None: return jsonify({'error': 'current_mileage required'}), 400
    
    try:
        vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Vehicle not found'}), 404
        
        # 1. Update Vehicle
        db.vehicles.update_one(
            {'_id': ObjectId(vehicle_id)},
            {'$set': {
                'current_mileage': int(new_mileage),
                'last_mileage_update': datetime.utcnow()
            }}
        )

        # 2. CREATE HISTORY RECORD (So it shows in the list)
        db.servicerecords.insert_one({
            "vehicle_id": ObjectId(vehicle_id),
            "service_type": "odometer_update",
            "service_date": datetime.utcnow(),
            "mileage_at_service": int(new_mileage),
            "cost": 0,
            "notes": "Manual odometer update",
            "created_at": datetime.utcnow(),
            "created_by": ObjectId(user_id)
        })
        
        # 3. Recalculate Predictions
        prediction_engine.calculate_predictions(ObjectId(vehicle_id))

        return jsonify({'message': 'Mileage updated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    try:
        vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Vehicle not found'}), 404
        return jsonify(vehicle_schema.dump(vehicle)), 200
    except Exception: return jsonify({'error': 'Invalid ID'}), 400

@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['DELETE'])
def delete_vehicle(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    try:
        db.vehicles.update_one({'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)}, {'$set': {'is_active': False}})
        return jsonify({'message': 'Deleted'}), 200
    except: return jsonify({'error': 'Failed'}), 500
