from flask import Blueprint, request, jsonify, session
from bson.objectid import ObjectId
from datetime import datetime
from marshmallow import ValidationError
from backend.models import db, service_record_schema, accident_history_schema
from backend.services.prediction import prediction_engine

# Create the Blueprint
history_bp = Blueprint('history_bp', __name__)

# ---------------------------------------------------------
# Add Service Record
# ---------------------------------------------------------
@history_bp.route('/vehicles/<string:vehicle_id>/services', methods=['POST'])
def add_service_record(vehicle_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id), "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Vehicle not found"}), 404
    except:
        return jsonify({"error": "Invalid ID"}), 400

    try:
        data = service_record_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify(err.messages), 400

    service_doc = {
        "vehicle_id": ObjectId(vehicle_id),
        "service_type": data['service_type'],
        "service_date": data['service_date'],
        "mileage_at_service": data['mileage_at_service'],
        "cost": data.get('cost'),
        "service_provider": data.get('service_provider'),
        "service_location": data.get('service_location'),
        "notes": data.get('notes'),
        "created_at": datetime.utcnow(),
        "created_by": ObjectId(user_id)
    }

    try:
        result = db.servicerecords.insert_one(service_doc)
        prediction_engine.calculate_predictions(ObjectId(vehicle_id))
        new_record = db.servicerecords.find_one({"_id": result.inserted_id})
        return jsonify(service_record_schema.dump(new_record)), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# Add Accident Record 
# ---------------------------------------------------------
@history_bp.route('/vehicles/<string:vehicle_id>/accidents', methods=['POST'])
def add_accident_record(vehicle_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id), "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Vehicle not found"}), 404
    except:
        return jsonify({"error": "Invalid ID"}), 400

    try:
        data = accident_history_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify(err.messages), 400

    accident_doc = {
        "vehicle_id": ObjectId(vehicle_id),
        "accident_date": data['accident_date'],
        "accident_location": data.get('accident_location'),
        "description": data['description'],
        "estimated_cost": data.get('estimated_cost'),
        "insurance_claim": data.get('insurance_claim'),
        "police_report_number": data.get('police_report_number'),
        "severity": data.get('severity'),
        "created_at": datetime.utcnow(),
        "created_by": ObjectId(user_id)
    }

    try:
        result = db.accidenthistory.insert_one(accident_doc)
        new_record = db.accidenthistory.find_one({"_id": result.inserted_id})
        return jsonify(accident_history_schema.dump(new_record)), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# List Service History
# ---------------------------------------------------------
@history_bp.route('/vehicles/<string:vehicle_id>/services', methods=['GET'])
def get_service_history(vehicle_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Optional Filters
    service_type = request.args.get('type')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = {"vehicle_id": ObjectId(vehicle_id)}
    
    if service_type:
        query["service_type"] = service_type
    
    if start_date or end_date:
        query["service_date"] = {}
        if start_date:
            query["service_date"]["$gte"] = datetime.fromisoformat(start_date)
        if end_date:
            query["service_date"]["$lte"] = datetime.fromisoformat(end_date)

    try:
        # Verify ownership first
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id), "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Vehicle not found"}), 404

        records = list(db.servicerecords.find(query).sort("service_date", -1))
        return jsonify([service_record_schema.dump(r) for r in records]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# List Accident History
# ---------------------------------------------------------
@history_bp.route('/vehicles/<string:vehicle_id>/accidents', methods=['GET'])
def get_accident_history(vehicle_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id), "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Vehicle not found"}), 404

        records = list(db.accidenthistory.find({"vehicle_id": ObjectId(vehicle_id)}).sort("accident_date", -1))
        return jsonify([accident_history_schema.dump(r) for r in records]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# Get Single Service Record
# ---------------------------------------------------------
@history_bp.route('/services/<string:service_id>', methods=['GET'])
def get_service_detail(service_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        record = db.servicerecords.find_one({"_id": ObjectId(service_id)})
        if not record:
            return jsonify({"error": "Record not found"}), 404
        
        # Verify ownership via vehicle
        vehicle = db.vehicles.find_one({"_id": record['vehicle_id'], "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Access denied"}), 403

        return jsonify(service_record_schema.dump(record)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# Update Service Record
# ---------------------------------------------------------
@history_bp.route('/services/<string:service_id>', methods=['PUT'])
def update_service_record(service_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data"}), 400

    try:
        # Validate partial update
        service_record_schema.load(data, partial=True)

        record = db.servicerecords.find_one({"_id": ObjectId(service_id)})
        if not record:
            return jsonify({"error": "Record not found"}), 404
        
        vehicle = db.vehicles.find_one({"_id": record['vehicle_id'], "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Access denied"}), 403

        # Update
        db.servicerecords.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": data}
        )
        
        # Trigger prediction recalculation if critical fields changed
        if 'service_date' in data or 'mileage_at_service' in data or 'service_type' in data:
            prediction_engine.calculate_predictions(record['vehicle_id'])

        updated_record = db.servicerecords.find_one({"_id": ObjectId(service_id)})
        return jsonify(service_record_schema.dump(updated_record)), 200

    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# Delete Service Record
# ---------------------------------------------------------
@history_bp.route('/services/<string:service_id>', methods=['DELETE'])
def delete_service_record(service_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        record = db.servicerecords.find_one({"_id": ObjectId(service_id)})
        if not record:
            return jsonify({"error": "Record not found"}), 404
        
        vehicle = db.vehicles.find_one({"_id": record['vehicle_id'], "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Access denied"}), 403

        db.servicerecords.delete_one({"_id": ObjectId(service_id)})
        
        # Recalculate predictions because history changed
        prediction_engine.calculate_predictions(record['vehicle_id'])

        return jsonify({"message": "Record deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
