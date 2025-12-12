"""
backend/services/prediction.py

This module contains the logic for calculating maintenance predictions based on
vehicle usage and service history.
"""

from datetime import datetime, timedelta
from bson.objectid import ObjectId
from backend.models import db
# 1. IMPORT THE TELEGRAM UTILITY
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
        Main entry point. Recalculates all predictions for a specific vehicle.
        Triggered whenever mileage is updated or a service is performed.
        """
        # 1. Get Vehicle Data
        vehicle = db.vehicles.find_one({"_id": vehicle_id})
        if not vehicle:
            print(f"Prediction Engine: Vehicle {vehicle_id} not found.")
            return

        current_mileage = vehicle.get('current_mileage', 0)
        initial_mileage = vehicle.get('initial_mileage', 0)
        
        # 2. Get User Data (For Notifications)
        user = db.users.find_one({"_id": vehicle.get('user_id')})
        chat_id = user.get('telegram_chat_id') if user else None
        user_name = user.get('full_name', 'Driver') if user else 'Driver'
        vehicle_name = f"{vehicle.get('manufacturer')} {vehicle.get('model')}"

        # 3. Calculate Average Daily Usage
        # Avoid division by zero if vehicle was just created
        days_owned = (datetime.utcnow() - vehicle['created_at']).days
        usage_km = current_mileage - initial_mileage
        
        if days_owned > 0 and usage_km > 0:
            avg_km_per_day = usage_km / days_owned
        else:
            # Fallback default (approx 15,000 km/year = ~41 km/day)
            avg_km_per_day = 41

        # 4. Process Each Service Type
        for service_type, interval_km in DEFAULT_INTERVALS.items():
            self._predict_single_type(
                vehicle_id, 
                service_type, 
                interval_km, 
                current_mileage, 
                avg_km_per_day,
                chat_id,      # Pass Chat ID
                user_name,    # Pass Name
                vehicle_name  # Pass Vehicle Name
            )

    def _predict_single_type(self, vehicle_id, service_type, interval_km, current_mileage, avg_km_per_day, chat_id, user_name, vehicle_name):
        """
        Calculates the due date and mileage for a specific service type.
        Sends notification if due soon.
        """
        # A. Find the LAST service record of this type
        last_service = db.servicerecords.find_one(
            {"vehicle_id": vehicle_id, "service_type": service_type},
            sort=[("service_date", -1)] # Sort descending (newest first)
        )

        # B. Determine Baseline
        if last_service:
            last_km = last_service['mileage_at_service']
            confidence = 0.9 # High confidence (based on real history)
        else:
            # No history? Assume it was done when vehicle was at 0 km (or never)
            last_km = 0 
            confidence = 0.3 # Low confidence (using defaults)

        # C. Calculate Due Mileage
        # Logic: (When it was last done) + (How long it lasts) - (Where we are now)
        next_due_mileage = last_km + interval_km
        km_remaining = next_due_mileage - current_mileage

        # D. Calculate Due Date
        # Logic: km_remaining / daily_usage = days_remaining
        if avg_km_per_day > 0:
            days_remaining = km_remaining / avg_km_per_day
        else:
            days_remaining = 365 # Fallback if usage is 0

        predicted_date = datetime.utcnow() + timedelta(days=days_remaining)

        # E. CHECK FOR NOTIFICATION (Due within 7 days or 500km)
        # Note: In a production app, you should check if a notification was ALREADY sent recently to avoid spam.
        if chat_id and (days_remaining <= 7 or km_remaining <= 500):
            self._send_alert(chat_id, user_name, vehicle_name, service_type, predicted_date, km_remaining)

        # F. Update Database
        # 1. Disable old active predictions for this type
        db.maintenancepredictions.update_many(
            {
                "vehicle_id": vehicle_id, 
                "maintenance_type": service_type,
                "is_active": True
            },
            {"$set": {"is_active": False}}
        )

        # 2. Insert new prediction
        new_prediction = {
            "vehicle_id": vehicle_id,
            "maintenance_type": service_type,
            "predicted_date": predicted_date,
            "predicted_mileage": int(next_due_mileage),
            "calculated_at": datetime.utcnow(),
            "notification_status": "sent" if (days_remaining <= 7) else "pending",
            "confidence_level": confidence,
            "is_active": True
        }
        
        try:
            db.maintenancepredictions.insert_one(new_prediction)
            print(f"Prediction updated for {service_type}: Due {predicted_date.date()}")
        except Exception as e:
            print(f"Error saving prediction: {e}")

    def _send_alert(self, chat_id, user_name, vehicle_name, service_type, due_date, km_remaining):
        """
        Helper to format and send the Telegram message.
        """
        try:
            readable_service = service_type.replace("_", " ").title()
            date_str = due_date.strftime('%Y-%m-%d')
            
            message = (
                f"⚠️ **Maintenance Due Soon!**\n\n"
                f"👤 **Driver:** {user_name}\n"
                f"🚗 **Vehicle:** {vehicle_name}\n"
                f"🔧 **Service:** {readable_service}\n"
                f"📅 **Estimated Date:** {date_str}\n"
                f"🛣️ **Km Remaining:** {int(km_remaining)} km\n\n"
                f"Please verify your vehicle status or schedule a workshop visit."
            )
            
            send_telegram_message(chat_id, message)
            print(f"🔔 Notification sent to {chat_id} for {service_type}")
            
        except Exception as e:
            print(f"❌ Failed to send notification: {e}")

# Create a singleton instance to be imported by other modules
prediction_engine = PredictionEngine()
