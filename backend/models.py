import os
import bcrypt
from pymongo import MongoClient
from bson.objectid import ObjectId
from marshmallow import Schema, fields, validate, ValidationError
from datetime import datetime

# --- Database Connection ---

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/motarilog")
client = MongoClient(MONGO_URI)
db = client.get_database()

# --- Custom Fields ---

class ObjectIdField(fields.Field):
    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        return str(value)

    def _deserialize(self, value, attr, data, **kwargs):
        try:
            return ObjectId(value)
        except Exception as e:
            raise ValidationError("Invalid ObjectId.") from e

# --- Schemas ---

class ManufacturerSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    name = fields.String(required=True)
    logo_url = fields.String(load_default=None) # URL to external logo or local file
    created_at = fields.DateTime(dump_only=True, dump_default=datetime.utcnow)

class UserSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    email = fields.Email(required=True)
    password_hash = fields.String(required=True, load_only=True)
    full_name = fields.String(required=True)
    phone_number = fields.String(required=False, allow_none=True)
    telegram_chat_id = fields.String(load_default=None)
    role = fields.String(
        validate=validate.OneOf(["user", "admin"]), 
        load_default="user"
    )
    created_at = fields.DateTime(dump_only=True, dump_default=datetime.utcnow)
    last_login = fields.DateTime(load_default=None)
    is_active = fields.Boolean(load_default=True)

class VehicleSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    user_id = ObjectIdField(required=True)
    manufacturer = fields.String(required=True)
    model = fields.String(required=True)
    year = fields.Integer(required=True, validate=validate.Range(min=1900))
    color = fields.String(required=False, allow_none=True)
    license_plate = fields.String(required=True)
    vin = fields.String(required=False, allow_none=True, validate=validate.Length(equal=17))
    purchase_date = fields.DateTime(required=False, allow_none=True)
    initial_mileage = fields.Integer(required=True, validate=validate.Range(min=0))
    current_mileage = fields.Integer(required=True, validate=validate.Range(min=0))
    image_filename = fields.String(load_default=None)
    last_mileage_update = fields.DateTime(load_default=datetime.utcnow)
    created_at = fields.DateTime(dump_only=True, dump_default=datetime.utcnow)
    is_active = fields.Boolean(load_default=True)

class ServiceRecordSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    vehicle_id = ObjectIdField(dump_only=True)
    service_type = fields.String(
        required=True,
        validate=validate.OneOf([
            "oil_change", "tire_rotation", "brake_service", 
            "timing_belt", "air_filter", "battery", "other"
        ])
    ) 
    service_date = fields.DateTime(required=True)
    mileage_at_service = fields.Integer(required=True, validate=validate.Range(min=0))
    cost = fields.Float(required=False, allow_none=True, validate=validate.Range(min=0))
    service_provider = fields.String(required=False, allow_none=True)
    service_location = fields.String(required=False, allow_none=True)
    notes = fields.String(required=False, allow_none=True, validate=validate.Length(max=1000)) 
    created_at = fields.DateTime(dump_only=True, dump_default=datetime.utcnow)
    created_by = ObjectIdField(dump_only=True)

class MaintenancePredictionSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    vehicle_id = ObjectIdField(dump_only=True)
    maintenance_type = fields.String(required=True) 
    predicted_date = fields.DateTime(required=True)
    predicted_mileage = fields.Integer(required=True)
    calculated_at = fields.DateTime(dump_only=True, dump_default=datetime.utcnow)
    last_notification_sent = fields.DateTime(required=False, allow_none=True)
    notification_status = fields.String(
        validate=validate.OneOf(["pending", "sent", "completed", "cancelled"]),
        load_default="pending"
    ) 
    confidence_level = fields.Float(
        required=False, 
        allow_none=True, 
        validate=validate.Range(min=0.0, max=1.0)
    )
    is_active = fields.Boolean(load_default=True)

class AccidentHistorySchema(Schema):
    _id = ObjectIdField(dump_only=True)
    vehicle_id = ObjectIdField(dump_only=True)
    accident_date = fields.DateTime(required=True)
    accident_location = fields.String(required=False, allow_none=True)
    description = fields.String(required=True, validate=validate.Length(max=2000))
    estimated_cost = fields.Float(required=False, allow_none=True, validate=validate.Range(min=0))
    insurance_claim = fields.String(required=False, allow_none=True)
    police_report_number = fields.String(required=False, allow_none=True)
    severity = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(["minor", "moderate", "severe", "total_loss"])
    ) 
    created_at = fields.DateTime(dump_only=True, dump_default=datetime.utcnow)
    created_by = ObjectIdField(dump_only=True)

# --- Workshops ---

class AddressSchema(Schema):
    street = fields.String(required=False, allow_none=True)
    city = fields.String(required=False, allow_none=True)
    region = fields.String(required=False, allow_none=True)
    postal_code = fields.String(required=False, allow_none=True)

class LocationSchema(Schema):
    type = fields.String(load_default="Point", validate=validate.OneOf(["Point"]))
    coordinates = fields.List(
        fields.Float(), 
        required=True, 
        validate=validate.Length(equal=2)
    )

class WorkshopSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    name = fields.String(required=True)
    address = fields.Nested(AddressSchema, required=True)
    location = fields.Nested(LocationSchema, required=True) 
    phone_number = fields.String(required=False, allow_none=True)
    services_offered = fields.List(fields.String(), required=False, allow_none=True)
    operating_hours = fields.String(required=False, allow_none=True)
    average_rating = fields.Float(
        required=False, 
        allow_none=True, 
        validate=validate.Range(min=0, max=5)
    )
    created_at = fields.DateTime(dump_only=True, dump_default=datetime.utcnow)
    updated_at = fields.DateTime(required=False, allow_none=True)
    is_active = fields.Boolean(load_default=True)

class SessionSchema(Schema):
    _id = fields.String(required=True)
    val = fields.Raw(required=True)
    expireAt = fields.DateTime(required=True)

# --- Initialize Schemas ---

user_schema = UserSchema()
vehicle_schema = VehicleSchema()
service_record_schema = ServiceRecordSchema()
maintenance_prediction_schema = MaintenancePredictionSchema()
accident_history_schema = AccidentHistorySchema()
workshop_schema = WorkshopSchema()
session_schema = SessionSchema()
manufacturer_schema = ManufacturerSchema() # NEW

# --- Database Initialization ---


def initialize_database():
    try:
        # User Indexes
        db.users.create_index("email", unique=True)
        db.users.create_index("role")
        
        # Vehicle Indexes
        db.vehicles.create_index("user_id")
        db.vehicles.create_index("license_plate", unique=True)
        
        # ServiceRecord Indexes
        db.servicerecords.create_index("vehicle_id")
        db.servicerecords.create_index([("vehicle_id", 1), ("service_date", -1)])
        
        # MaintenancePrediction Indexes
        db.maintenancepredictions.create_index("vehicle_id")
        db.maintenancepredictions.create_index("predicted_date")
        db.maintenancepredictions.create_index("notification_status")
        
        # AccidentHistory Indexes
        db.accidenthistory.create_index("vehicle_id")
        
        # Workshop Indexes
        db.workshops.create_index([("location", "2dsphere")]) 
        db.workshops.create_index("services_offered")
        
        # Manufacturer Index
        db.manufacturers.create_index("name", unique=True)

        # Session Index
        db.sessions.create_index("expireAt", expireAfterSeconds=0)

        print("Database initialized and indexes ensured.")

        print("Updating manufacturer logos to SimpleIcons...")
        defaults = [
            {"name": "Toyota", "logo_url": "https://cdn.simpleicons.org/toyota"},
            {"name": "Honda", "logo_url": "https://cdn.simpleicons.org/honda"},
            {"name": "Ford", "logo_url": "https://cdn.simpleicons.org/ford"},
            {"name": "BMW", "logo_url": "https://cdn.simpleicons.org/bmw"},
            {"name": "Mercedes", "logo_url": "https://cdn.simpleicons.org/mercedes"},
            {"name": "Chevrolet", "logo_url": "https://cdn.simpleicons.org/chevrolet"},
            {"name": "Nissan", "logo_url": "https://cdn.simpleicons.org/nissan"},
            {"name": "Hyundai", "logo_url": "https://cdn.simpleicons.org/hyundai"},
            {"name": "Kia", "logo_url": "https://cdn.simpleicons.org/kia"},
            {"name": "Audi", "logo_url": "https://cdn.simpleicons.org/audi"},
            {"name": "Volkswagen", "logo_url": "https://cdn.simpleicons.org/volkswagen"},
            {"name": "Tesla", "logo_url": "https://cdn.simpleicons.org/tesla"},
            {"name": "Lexus", "logo_url": "https://simpleicons.org/icons/lexus.svg"}, # Fallback or specific SVG
            {"name": "Subaru", "logo_url": "https://cdn.simpleicons.org/subaru"},
            {"name": "Mazda", "logo_url": "https://cdn.simpleicons.org/mazda"}
        ]
        
        for maker in defaults:
            try:
                # Force update the logo_url for existing makers
                db.manufacturers.update_one(
                    {"name": maker["name"]},
                    {"$set": {"logo_url": maker["logo_url"]}},
                    upsert=True
                )
            except Exception as e:
                print(f"Error seeding {maker['name']}: {e}")

        # --- Create/Update Default Admin Account ---
        admin_email = "admin@motarilog.com"
        admin_pass_raw = "admin123"
        hashed_pw_bytes = bcrypt.hashpw(admin_pass_raw.encode('utf-8'), bcrypt.gensalt())
        hashed_pw_str = hashed_pw_bytes.decode('utf-8')

        admin_user = db.users.find_one({"email": admin_email})
        
        if not admin_user:
            print("Creating default Admin account...")
            db.users.insert_one({
                "name": "System Admin",
                "email": admin_email,
                "password_hash": hashed_pw_str, 
                "role": "admin",  
                "created_at": datetime.utcnow(),
                "is_active": True
            })
        else:
            db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hashed_pw_str}}
            )

    except Exception as e:
        print(f"Error initializing database: {e}")
