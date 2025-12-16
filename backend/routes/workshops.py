from flask import Blueprint, request, jsonify, session
from backend.models import db
from bson.objectid import ObjectId

workshops_bp = Blueprint('workshops_bp', __name__)

# --- Route 1: Find Nearby Workshops (Public) ---
@workshops_bp.route('/workshops/nearby', methods=['GET'])
def find_nearby_workshops():
    try:
        latitude = request.args.get('lat', type=float)
        longitude = request.args.get('lng', type=float)
        
        radius = request.args.get('radius', default=40000000, type=float) 
        service_filter = request.args.get('service', type=str)

        if latitude is not None and longitude is not None:
            query = {
                "location": {
                    "$nearSphere": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [longitude, latitude]
                        },
                        "$maxDistance": radius
                    }
                },
                "is_active": True
            }
        else:
            query = {"is_active": True}

        if service_filter and service_filter != 'all':
            query["services_offered"] = service_filter

        workshops_cursor = db.workshops.find(query)
        
        results = []
        for doc in workshops_cursor:
            results.append({
                "id": str(doc.get('_id')),
                "name": doc.get('name'),
                "address": doc.get('address', {}).get('street', 'Unknown Address'),
                "location": doc.get('location'), 
                "services": doc.get('services_offered', []),
                "phone": doc.get('phone_number'),
                "rating": doc.get('average_rating', 0.0)
            })

        return jsonify({"count": len(results), "workshops": results}), 200

    except Exception as e:
        print(f"Error in nearby workshops: {e}")
        return jsonify({"error": str(e)}), 500


# --- Route 2: Add New Workshop (ADMIN ONLY) ---
@workshops_bp.route('/workshops/add', methods=['POST'])
def add_workshop():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        current_user = db.users.find_one({"_id": ObjectId(user_id)})
        
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({"error": "Forbidden: Admins only"}), 403

        data = request.get_json()
        
        if not data.get('name') or not data.get('lat') or not data.get('lng'):
            return jsonify({"error": "Missing required fields"}), 400

        new_workshop = {
            "name": data['name'],
            "address": {"street": data.get('address', '')},
            "phone_number": data.get('phone', ''),
            "average_rating": 5.0,
            "services_offered": data.get('services', ['general_repair']), 
            "is_active": True,
            "location": {
                "type": "Point",
                "coordinates": [float(data['lng']), float(data['lat'])] 
            }
        }

        result = db.workshops.insert_one(new_workshop)

        return jsonify({
            "message": "Workshop added successfully", 
            "id": str(result.inserted_id)
        }), 201

    except Exception as e:
        print(f"Error adding workshop: {e}")
        return jsonify({"error": str(e)}), 500

# --- Route 3: Delete Workshop (ADMIN ONLY) ---
@workshops_bp.route('/workshops/<string:workshop_id>', methods=['DELETE'])
def delete_workshop(workshop_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        current_user = db.users.find_one({"_id": ObjectId(user_id)})
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({"error": "Forbidden"}), 403

        # Soft delete (set is_active to False)
        result = db.workshops.update_one(
            {"_id": ObjectId(workshop_id)},
            {"$set": {"is_active": False}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Workshop not found"}), 404

        return jsonify({"message": "Workshop deleted"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
