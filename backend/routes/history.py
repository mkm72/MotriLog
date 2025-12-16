from flask import Blueprint, request, jsonify, session
from bson.objectid import ObjectId
from datetime import datetime
from backend.models import db, service_record_schema
from backend.services.prediction import prediction_engine

history_bp = Blueprint('history_bp', __name__)

# ---------------------------------------------------------
# GET HISTORY (For a Vehicle)
# ---------------------------------------------------------
@history_bp.route('/vehicles/<string:vehicle_id>/services', methods=['GET'])
def get_service_history(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401

    try:
        # Ensure user owns vehicle
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id), "user_id": ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Vehicle not found'}), 404

        records = list(db.servicerecords.find({"vehicle_id": ObjectId(vehicle_id)}).sort("service_date", -1))
        return jsonify([service_record_schema.dump(r) for r in records]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# ADD SERVICE RECORD
# ---------------------------------------------------------
@history_bp.route('/vehicles/<string:vehicle_id>/services', methods=['POST'])
def add_service_record(vehicle_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    if not data: return jsonify({'error': 'No data'}), 400

    try:
        # 1. Validate Ownership
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id), "user_id": ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Vehicle not found'}), 404

        # 2. Prepare Record
        record = {
            "vehicle_id": ObjectId(vehicle_id),
            "service_type": data['service_type'],
            "service_date": datetime.strptime(data['service_date'], '%Y-%m-%d'),
            "mileage_at_service": int(data['mileage_at_service']),
            "cost": float(data.get('cost', 0)),
            "notes": data.get('notes', ''),
            "created_at": datetime.utcnow(),
            "created_by": ObjectId(user_id)
        }

        # 3. Insert
        db.servicerecords.insert_one(record)

        if record['mileage_at_service'] > vehicle['current_mileage']:
            db.vehicles.update_one(
                {"_id": ObjectId(vehicle_id)},
                {"$set": {
                    "current_mileage": record['mileage_at_service'],
                    "last_mileage_update": datetime.utcnow()
                }}
            )

        prediction_engine.calculate_predictions(vehicle_id)

        return jsonify({'message': 'Service added successfully'}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------
# DELETE SERVICE RECORD (WITH MILEAGE ROLLBACK)
# ---------------------------------------------------------
@history_bp.route('/services/<string:record_id>', methods=['DELETE'])
def delete_service_record(record_id):
    user_id = session.get('user_id')
    if not user_id: return jsonify({'error': 'Unauthorized'}), 401

    try:
        # 1. Find Record
        record = db.servicerecords.find_one({"_id": ObjectId(record_id)})
        if not record: return jsonify({'error': 'Record not found'}), 404

        vehicle_id = record['vehicle_id']

        # 2. Check Ownership
        vehicle = db.vehicles.find_one({"_id": vehicle_id, "user_id": ObjectId(user_id)})
        if not vehicle: return jsonify({'error': 'Unauthorized'}), 403

        # 3. Delete the Record
        db.servicerecords.delete_one({"_id": ObjectId(record_id)})

        latest_record = db.servicerecords.find_one(
            {"vehicle_id": vehicle_id},
            sort=[("mileage_at_service", -1)] # Sort Descending (Highest first)
        )

        highest_history_km = latest_record['mileage_at_service'] if latest_record else 0
        initial_km = vehicle.get('initial_mileage', 0)

        # The new current mileage is the MAX of (Initial, Highest History)
        # This ensures we don't drop below the start mileage
        new_current_km = max(initial_km, highest_history_km)

        # 5. Update Vehicle
        db.vehicles.update_one(
            {"_id": vehicle_id},
            {"$set": {
                "current_mileage": new_current_km,
                "last_mileage_update": datetime.utcnow()
            }}
        )

        # 6. Recalculate Predictions based on new mileage
        prediction_engine.calculate_predictions(vehicle_id)

        return jsonify({
            'message': 'Record deleted and mileage updated',
            'new_mileage': new_current_km
        }), 200

    except Exception as e:
        print(f"Error deleting record: {e}")
        return jsonify({'error': str(e)}), 500
