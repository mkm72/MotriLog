from flask import Blueprint, request, jsonify, session
from bson.objectid import ObjectId
from datetime import datetime
from marshmallow import ValidationError
from backend.models import db, vehicle_schema

vehicles_bp = Blueprint('vehicles_bp', __name__)

# ---------------------------------------------------------
# Get All User's Vehicles
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles', methods=['GET'])
def get_vehicles():
    # Check if user is logged in
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Get all vehicles for this user
        vehicles = list(db.vehicles.find({
            'user_id': ObjectId(user_id),
            'is_active': True
        }))
        
        # Convert to JSON-serializable format
        vehicles_data = [vehicle_schema.dump(v) for v in vehicles]
        
        return jsonify(vehicles_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------
# Add New Vehicle
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles', methods=['POST'])
def add_vehicle():
    # Check if user is logged in
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Get JSON data
    json_data = request.get_json()
    if not json_data:
        return jsonify({'error': 'No input data provided'}), 400
    
    # Add user_id to the data
    json_data['user_id'] = user_id
    
    # Validate input data
    try:
        data = vehicle_schema.load(json_data)
    except ValidationError as err:
        return jsonify(err.messages), 400
    
    # Check if license plate already exists
    existing_vehicle = db.vehicles.find_one({
        'license_plate': data['license_plate']
    })
    
    if existing_vehicle:
        return jsonify({'error': 'License plate already registered'}), 409
    
    # Set current_mileage to initial_mileage if not provided
    if 'current_mileage' not in data:
        data['current_mileage'] = data['initial_mileage']
    
    # Create vehicle document
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
        'last_mileage_update': datetime.utcnow(),
        'created_at': datetime.utcnow(),
        'is_active': True
    }
    
    # Insert into database
    try:
        result = db.vehicles.insert_one(vehicle_doc)
        
        # Fetch the created vehicle
        new_vehicle = db.vehicles.find_one({'_id': result.inserted_id})
        
        return jsonify({
            'message': 'Vehicle added successfully',
            'vehicle': vehicle_schema.dump(new_vehicle)
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------
# Get Specific Vehicle
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    # Check if user is logged in
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Get vehicle and verify ownership
        vehicle = db.vehicles.find_one({
            '_id': ObjectId(vehicle_id),
            'user_id': ObjectId(user_id)
        })
        
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404
        
        return jsonify(vehicle_schema.dump(vehicle)), 200
    
    except Exception:
        return jsonify({'error': 'Invalid vehicle ID'}), 400


# ---------------------------------------------------------
# Update Vehicle Mileage
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>/mileage', methods=['PUT'])
def update_mileage(vehicle_id):
    # Check if user is logged in
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Get JSON data
    json_data = request.get_json()
    if not json_data:
        return jsonify({'error': 'No input data provided'}), 400
    
    new_mileage = json_data.get('current_mileage')
    
    if new_mileage is None:
        return jsonify({'error': 'current_mileage is required'}), 400
    
    try:
        # Get vehicle and verify ownership
        vehicle = db.vehicles.find_one({
            '_id': ObjectId(vehicle_id),
            'user_id': ObjectId(user_id)
        })
        
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404
        
        # Validate new mileage
        if new_mileage <= vehicle['current_mileage']:
            return jsonify({'error': 'New mileage must be greater than current mileage'}), 400
        
        # Update mileage
        db.vehicles.update_one(
            {'_id': ObjectId(vehicle_id)},
            {
                '$set': {
                    'current_mileage': new_mileage,
                    'last_mileage_update': datetime.utcnow()
                }
            }
        )
        
        # Get updated vehicle
        updated_vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id)})
        
        return jsonify({
            'message': 'Mileage updated successfully',
            'vehicle': vehicle_schema.dump(updated_vehicle)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------
# Delete Vehicle (Soft Delete)
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['DELETE'])
def delete_vehicle(vehicle_id):
    # Check if user is logged in
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Get vehicle and verify ownership
        vehicle = db.vehicles.find_one({
            '_id': ObjectId(vehicle_id),
            'user_id': ObjectId(user_id)
        })
        
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404
        
        # Soft delete (set is_active to False)
        db.vehicles.update_one(
            {'_id': ObjectId(vehicle_id)},
            {'$set': {'is_active': False}}
        )
        
        return jsonify({'message': 'Vehicle deleted successfully'}), 200
    
    except Exception:
        return jsonify({'error': 'Invalid vehicle ID'}), 400




# ---------------------------------------------------------
# Update General Vehicle Info
# ---------------------------------------------------------
@vehicles_bp.route('/vehicles/<string:vehicle_id>', methods=['PUT'])
def update_vehicle(vehicle_id):
    # 1. Check Authentication
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    # 2. Get Input Data
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400

    # 3. Filter Allowed Fields
    allowed_fields = ['manufacturer', 'model', 'year', 'color', 'license_plate', 'vin', 'purchase_date', 'initial_mileage']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return jsonify({'error': 'No valid fields to update'}), 400

    try:
        # 4. Validate Data using Schema 
        vehicle_schema.load(update_data, partial=True)

        # 5. Verify Ownership
        vehicle = db.vehicles.find_one({
            '_id': ObjectId(vehicle_id),
            'user_id': ObjectId(user_id)
        })

        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404

        # 6. Check License Plate Uniqueness
        if 'license_plate' in update_data and update_data['license_plate'] != vehicle['license_plate']:
            existing = db.vehicles.find_one({'license_plate': update_data['license_plate']})
            if existing:
                return jsonify({'error': 'License plate already registered'}), 409

        # 7. Update Database
        db.vehicles.update_one(
            {'_id': ObjectId(vehicle_id)},
            {'$set': update_data}
        )

        # 8. Return Updated Vehicle
        updated_vehicle = db.vehicles.find_one({'_id': ObjectId(vehicle_id)})
        return jsonify(vehicle_schema.dump(updated_vehicle)), 200

    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
