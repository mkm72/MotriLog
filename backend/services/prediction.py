"""
backend/services/prediction.py

This module contains the logic for calculating maintenance predictions based on
vehicle usage and service history.
"""

from datetime import datetime, timedelta
from backend.models import db

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
        
        # 2. Calculate Average Daily Usage
        # Avoid division by zero if vehicle was just created
        days_owned = (datetime.utcnow() - vehicle['created_at']).days
        usage_km = current_mileage - initial_mileage
        
        if days_owned > 0 and usage_km > 0:
            avg_km_per_day = usage_km / days_owned
        else:
            # Fallback default (approx 15,000 km/year = ~41 km/day)
            avg_km_per_day = 41

        # 3. Process Each Service Type
        for service_type, interval_km in DEFAULT_INTERVALS.items():
            self._predict_single_type(
                vehicle_id, 
                service_type, 
                interval_km, 
                current_mileage, 
                avg_km_per_day
            )

    def _predict_single_type(self, vehicle_id, service_type, interval_km, current_mileage, avg_km_per_day):
        """
        Calculates the due date and mileage for a specific service type.
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
            # This will likely trigger an immediate 'due' notification if mileage is high
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

        # E. Update Database
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
            "notification_status": "pending",
            "confidence_level": confidence,
            "is_active": True
        }
        
        try:
            db.maintenancepredictions.insert_one(new_prediction)
            print(f"Prediction updated for {service_type}: Due {predicted_date.date()}")
        except Exception as e:
            print(f"Error saving prediction: {e}")

# Create a singleton instance to be imported by other modules
prediction_engine = PredictionEngine()
