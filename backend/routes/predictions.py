from flask import Blueprint, request, jsonify, session
from bson.objectid import ObjectId
from datetime import datetime
from backend.models import db, maintenance_prediction_schema, service_record_schema
from backend.services.prediction import prediction_engine

predictions_bp = Blueprint('predictions_bp', __name__)

# ---------------------------------------------------------
# Route: Get Predictions for a Vehicle
# ---------------------------------------------------------
@predictions_bp.route('/vehicles/<string:vehicle_id>/predictions', methods=['GET'])
def get_predictions(vehicle_id):
    # 1. Authentication Check
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # 2. Verify Ownership
    try:
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id), "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Vehicle not found"}), 404
    except:
        return jsonify({"error": "Invalid vehicle ID"}), 400

    # 3. Filtering Logic (active_only, include_past)
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    
    query = {"vehicle_id": ObjectId(vehicle_id)}
    
    if active_only:
        query["is_active"] = True

    # 4. Fetch and Return Predictions
    try:
        # Sort by date ascending (soonest first)
        predictions = list(db.maintenancepredictions.find(query).sort("predicted_date", 1))
        
        return jsonify([maintenance_prediction_schema.dump(p) for p in predictions]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@predictions_bp.route('/predictions/<string:prediction_id>/complete', methods=['PUT'])
def complete_prediction(prediction_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # 1. Find the prediction
        prediction = db.maintenancepredictions.find_one({"_id": ObjectId(prediction_id)})
        if not prediction:
            return jsonify({"error": "Prediction not found"}), 404

        # 2. Verify Ownership (via Vehicle)
        vehicle = db.vehicles.find_one({"_id": prediction['vehicle_id'], "user_id": ObjectId(user_id)})
        if not vehicle:
            return jsonify({"error": "Access denied"}), 403

        # 3. Create a Service Record automatically
        # We assume the service was done TODAY at the CURRENT mileage
        service_doc = {
            "vehicle_id": prediction['vehicle_id'],
            "service_type": prediction['maintenance_type'],
            "service_date": datetime.utcnow(),
            "mileage_at_service": vehicle['current_mileage'], # Or ask user for input in a real UI
            "cost": 0, # Placeholder
            "service_provider": "Self/Unknown",
            "notes": "Completed from maintenance reminder",
            "created_at": datetime.utcnow(),
            "created_by": ObjectId(user_id)
        }
        
        result = db.servicerecords.insert_one(service_doc)

        # 4. Deactivate the Prediction
        db.maintenancepredictions.update_one(
            {"_id": ObjectId(prediction_id)},
            {"$set": {"is_active": False, "notification_status": "completed"}}
        )

        # 5. Trigger Engine to Calculate NEXT due date
        prediction_engine.calculate_predictions(prediction['vehicle_id'])

        # Return the new service record
        new_record = db.servicerecords.find_one({"_id": result.inserted_id})
        return jsonify(service_record_schema.dump(new_record)), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# Route: Cancel/Ignore Prediction
# ---------------------------------------------------------
@predictions_bp.route('/predictions/<string:prediction_id>/cancel', methods=['PUT'])
def cancel_prediction(prediction_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # Verify and Deactivate
        
        prediction = db.maintenancepredictions.find_one({"_id": ObjectId(prediction_id)})
        if not prediction: return jsonify({"error": "Not found"}), 404
        
        vehicle = db.vehicles.find_one({"_id": prediction['vehicle_id'], "user_id": ObjectId(user_id)})
        if not vehicle: return jsonify({"error": "Access denied"}), 403

        db.maintenancepredictions.update_one(
            {"_id": ObjectId(prediction_id)},
            {"$set": {"is_active": False, "notification_status": "cancelled"}}
        )
        
        return jsonify({"message": "Prediction cancelled"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
