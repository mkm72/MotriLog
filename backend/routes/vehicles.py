from flask import Blueprint, request, jsonify, session, current_app
from bson.objectid import ObjectId
from datetime import datetime
from marshmallow import ValidationError
from backend.models import db, vehicle_schema, manufacturer_schema
import os
import uuid
from werkzeug.utils import secure_filename

vehicles_bp = Blueprint('vehicles_bp', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------------------------------------------------
# NEW: Get All Manufacturers
# ---------------------------------------------------------
@vehicles_bp.route('/manufacturers', methods=['GET'])
def get_manufacturers():
    try:
        # Get all makers, sorted by name
        makers = list(db.manufacturers.find().sort("name", 1))
        return jsonify([manufacturer_schema.dump(m) for m in makers]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# Get All User's Vehicles
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles', methods=['GET'])
def get_vehicles():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        vehicles = list(db.vehicles.find({
            'user_id': ObjectId(user_id),
            'is_active': True
        }))
        vehicles_data = [vehicle_schema.dump(v) for v in vehicles]
        return jsonify(vehicles_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# Add New Vehicle (Auto-adds Manufacturer)
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles', methods=['POST'])
def add_vehicle():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # 1. Handle Input (Multipart vs JSON)
    if request.content_type.startswith('multipart/form-data'):
        json_data = request.form.to_dict()
    else:
        json_data = request.get_json()

    if not json_data:
        return jsonify({'error': 'No input data provided'}), 400
    
    json_data['user_id'] = user_id
    
    # 2. Validate Text Data
    try:
        data = vehicle_schema.load(json_data)
    except ValidationError as err:
        return jsonify(err.messages), 400
    
    # 3. Check License Plate
    existing_vehicle = db.vehicles.find_one({'license_plate': data['license_plate']})
    if existing_vehicle:
        return jsonify({'error': 'License plate already registered'}), 409

    # --- NEW LOGIC: Check & Add Manufacturer ---
    # We check if this manufacturer exists; if not, we add it.
    maker_name = data['manufacturer'].strip()
    
    # Case-insensitive check
    existing_maker = db.manufacturers.find_one({
        "name": {"$regex": f"^{maker_name}$", "$options": "i"}
    })
    
    if not existing_maker:
        try:
            db.manufacturers.insert_one({
                "name": maker_name,
                "logo_url": None, # No logo for manual entry
                "created_at": datetime.utcnow()
            })
            print(f"🆕 Auto-added new manufacturer: {maker_name}")
        except Exception as e:
            print(f"Error adding maker: {e}")
    # -------------------------------------------

    # 4. Handle Image Upload
    image_db_path = None
    if 'image' in request.files:
        file = request.files['image']
        if file and allowed_file(file.filename):
            try:
                ext = file.filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4().hex}.{ext}"
                
                base_upload_path = current_app.config['UPLOAD_FOLDER']
                user_folder_path = os.path.join(base_upload_path, str(user_id))
                os.makedirs(user_folder_path, exist_ok=True)
                
                file.save(os.path.join(user_folder_path, unique_filename))
                image_db_path = f"{user_id}/{unique_filename}"
            except Exception as e:
                print(f"Image save failed: {e}")

    # 5. Prepare Database Document
    if 'current_mileage' not in data:
        data['current_mileage'] = data['initial_mileage']
    
    vehicle_doc = {
        'user_id': ObjectId(user_id),
        'manufacturer': data['manufacturer'], # The submitted name
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
        new_vehicle = db.vehicles.find_one({'_id': result.inserted_id})
        return jsonify({
            'message': 'Vehicle added successfully',
            'vehicle': vehicle_schema.dump(new_vehicle)
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# Update Vehicle
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['PUT'])
def update_vehicle(vehicle_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    if request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
    else:
        data = request.get_json() or {}

    allowed_fields = ['manufacturer', 'model', 'year', 'color', 'license_plate', 'vin', 'purchase_date', 'initial_mileage']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if 'image' in request.files:
        file = request.files['image']
        if file and allowed_file(file.filename):
            try:
                ext = file.filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4().hex}.{ext}"
                
                base_upload_path = current_app.config['UPLOAD_FOLDER']
                user_folder_path = os.path.join(base_upload_path, str(user_id))
                os.makedirs(user_folder_path, exist_ok=True)
                
                file.save(os.path.join(user_folder_path, unique_filename))
                update_data['image_filename'] = f"{user_id}/{unique_filename}"
            except Exception as e:
                print(f"Error saving image: {e}")

    if not update_data and 'image' not in request.files:
         return jsonify({'error': 'No valid fields to update'}), 400

    try:
        if 'license_plate' in update_data:
            vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id)})
            if vehicle and vehicle['license_plate'] != update_data['license_plate']:
                existing = db.vehicles.find_one({'license_plate': update_data['license_plate']})
                if existing:
                    return jsonify({'error': 'License plate already registered'}), 409

        db.vehicles.update_one(
            {'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        updated_vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id)})
        return jsonify(vehicle_schema.dump(updated_vehicle)), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# Get Specific Vehicle
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    try:
        vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Vehicle not found'}), 404
        return jsonify(vehicle_schema.dump(vehicle)), 200
    except Exception: return jsonify({'error': 'Invalid vehicle ID'}), 400

# ---------------------------------------------------------
# Update Mileage
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>/mileage', methods=['PUT'])
def update_mileage(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    json_data = request.get_json()
    new_mileage = json_data.get('current_mileage')
    if new_mileage is None: return jsonify({'error': 'current_mileage is required'}), 400
    try:
        vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Vehicle not found'}), 404
        if new_mileage <= vehicle['current_mileage']: return jsonify({'error': 'New mileage must be greater'}), 400
        db.vehicles.update_one({'_id': ObjectId(vehicle_id)}, {'$set': {'current_mileage': new_mileage, 'last_mileage_update': datetime.utcnow()}})
        return jsonify({'message': 'Mileage updated', 'vehicle': vehicle_schema.dump(db.vehicles.find_one({'_id': ObjectId(vehicle_id)}))}), 200
    except Exception as e: return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# Delete Vehicle
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['DELETE'])
def delete_vehicle(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401
    try:
        vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id), 'user_id': ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Vehicle not found'}), 404
        db.vehicles.update_one({'_id': ObjectId(vehicle_id)}, {'$set': {'is_active': False}})
        return jsonify({'message': 'Vehicle deleted successfully'}), 200
    except Exception: return jsonify({'error': 'Invalid vehicle ID'}), 400
