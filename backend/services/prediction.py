"""
backend/services/prediction.py
Smart Prediction Engine with Notifications
"""

import math
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from backend.models import db
from backend.utils import send_telegram_message

DEFAULT_INTERVALS = {
    "oil_change": 5000,
    "tire_rotation": 10000,
    "air_filter": 20000,
    "brake_service": 20000,
    "battery": 30000,
    "timing_belt": 80000,
    "other": 10000
}

class PredictionEngine:
    def calculate_predictions(self, vehicle_id):
        """
        Recalculates predictions.
        Triggered by: Add Vehicle, Update Mileage, Complete Service.
        """
        # 1. Get Vehicle
        vehicle = db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
        if not vehicle:
            print(f" Prediction Engine: Vehicle {vehicle_id} not found.")
            return

        current_mileage = vehicle.get('current_mileage', 0)
        initial_mileage = vehicle.get('initial_mileage', 0)
        
        # 2. Get User (For Notifications)
        user = db.users.find_one({"_id": vehicle.get('user_id')})
        chat_id = user.get('telegram_chat_id') if user else None
        user_name = user.get('full_name', 'Driver') if user else 'Driver'
        vehicle_name = f"{vehicle.get('manufacturer')} {vehicle.get('model')}"

        # 3. Calculate Average Daily Usage
        days_owned = (datetime.utcnow() - vehicle['created_at']).days
        usage_km = current_mileage - initial_mileage
        
        if days_owned > 7 and usage_km > 0:
            avg_km_per_day = usage_km / days_owned
        else:
            # Default: ~15,000 km/year = 41 km/day
            avg_km_per_day = 41

        # 4. Process Each Service Type
        for service_type, interval_km in DEFAULT_INTERVALS.items():
            self._predict_single_type(
                vehicle['_id'], 
                service_type, 
                interval_km, 
                current_mileage, 
                avg_km_per_day,
                chat_id, user_name, vehicle_name
            )

    def _predict_single_type(self, vehicle_id, service_type, interval_km, current_mileage, avg_km_per_day, chat_id, user_name, vehicle_name):
        # A. Find Last Service Record
        last_service = db.servicerecords.find_one(
            {"vehicle_id": vehicle_id, "service_type": service_type},
            sort=[("service_date", -1)]
        )

        # B. Smart Calculation
        if last_service:
            # Case 1: We have history. Follow the interval from last service.
            last_km = last_service['mileage_at_service']
            next_due_mileage = last_km + interval_km
            confidence = 0.9
        else:
            # Case 2: No history (New/Used car). Snap to next milestone.
            # Example: Current=102k, Interval=5k. 
            # We assume it was done at 100k. Next due is 105k.
            if current_mileage > 0:
                # Logic: Find next multiple of interval_km
                next_due_mileage = math.ceil(current_mileage / interval_km) * interval_km
                
                # If we are exactly ON the milestone, add one interval
                if next_due_mileage <= current_mileage:
                    next_due_mileage += interval_km
            else:
                next_due_mileage = interval_km
            
            confidence = 0.5 # Lower confidence since it's a guess

        km_remaining = next_due_mileage - current_mileage

        # C. Calculate Due Date
        if avg_km_per_day > 0:
            days_remaining = km_remaining / avg_km_per_day
        else:
            days_remaining = 365 # Fallback

        # Don't predict dates in the past (if overdue, set to today)
        if days_remaining < 0: days_remaining = 0
        
        predicted_date = datetime.utcnow() + timedelta(days=days_remaining)

        # D. Notifications (Only if due within 7 days or 500km)
        # Note: Added check to prevent spamming 'sent' alerts repeatedly
        should_notify = chat_id and (days_remaining <= 7 or km_remaining <= 500)
        
        # Check if we already sent a notification recently for this
        existing_pred = db.maintenancepredictions.find_one({
            "vehicle_id": vehicle_id, "maintenance_type": service_type, "is_active": True
        })
        
        if existing_pred and existing_pred.get('notification_status') == 'sent':
            should_notify = False # Already alerted

        if should_notify:
            self._send_alert(chat_id, user_name, vehicle_name, service_type, predicted_date, km_remaining)

        # E. Update Database
        db.maintenancepredictions.update_many(
            {"vehicle_id": vehicle_id, "maintenance_type": service_type, "is_active": True},
            {"$set": {"is_active": False}}
        )

        # Insert New
        new_prediction = {
            "vehicle_id": vehicle_id,
            "maintenance_type": service_type,
            "predicted_date": predicted_date,
            "predicted_mileage": int(next_due_mileage),
            "calculated_at": datetime.utcnow(),
            "notification_status": "sent" if should_notify else "pending",
            "confidence_level": confidence,
            "is_active": True
        }
        db.maintenancepredictions.insert_one(new_prediction)

    def _send_alert(self, chat_id, user_name, vehicle_name, service_type, due_date, km_remaining):
        try:
            readable_service = service_type.replace("_", " ").title()
            date_str = due_date.strftime('%Y-%m-%d')
            
            message = (
                f"⚠️ **Maintenance Alert**\n\n"
                f"🚗 {vehicle_name}\n"
                f"🔧 **{readable_service}**\n"
                f"📅 Due: {date_str}\n"
                f"🛣️ Remaining: {int(km_remaining)} km\n\n"
                f"Please schedule a service."
            )
            send_telegram_message(chat_id, message)
            print(f" Alert sent to {user_name} for {service_type}")
        except Exception as e:
            print(f" Alert failed: {e}")

prediction_engine = PredictionEngine()
