
import os
from pymongo import MongoClient, TEXT, HASHED
from bson.objectid import ObjectId
from marshmallow import Schema, fields, validate, post_load
from datetime import datetime

# --- Database Connection ---

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/motarilog")
client = MongoClient(MONGO_URI)

db = client.get_database()


class ObjectIdField(fields.Field):
    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        return str(value)

    def _deserialize(self, value, attr, data, **kwargs):
        try:
            return ObjectId(value)
        except Exception as e:
            raise validate.ValidationError("Invalid ObjectId.") from e


class UserSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    email = fields.Email(required=True)
    password_hash = fields.String(required=True, load_only=True) # load_only = never send in API response
    full_name = fields.String(required=True)
    phone_number = fields.String(required=False, allow_none=True)
    telegram_chat_id = fields.String(required=False, allow_none=True)
    role = fields.String(required=True, validate=validate.OneOf(["user", "admin"]), default="user")
    created_at = fields.DateTime(dump_only=True, default=datetime.utcnow)
    last_login = fields.DateTime(required=False, allow_none=True)
    is_active = fields.Boolean(default=True)

class VehicleSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    user_id = ObjectIdField(required=True)
    manufacturer = fields.String(required=True)
    model = fields.String(required=True)
    year = fields.Integer(required=True, validate=validate.Range(min=1900)) [cite: 935]
    color = fields.String(required=False, allow_none=True)
    license_plate = fields.String(required=True)
    vin = fields.String(required=False, allow_none=True, validate=validate.Length(equal=17)) [cite: 2437]
    purchase_date = fields.DateTime(required=False, allow_none=True)
    initial_mileage = fields.Integer(required=True, validate=validate.Range(min=0))
    current_mileage = fields.Integer(required=True, validate=validate.Range(min=0))
    last_mileage_update = fields.DateTime(required=True, default=datetime.utcnow)
    created_at = fields.DateTime(dump_only=True, default=datetime.utcnow)
    is_active = fields.Boolean(default=True)

class ServiceRecordSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    vehicle_id = ObjectIdField(required=True)
    service_type = fields.String(
        required=True,
        validate=validate.OneOf([
            "oil_change", "tire_rotation", "brake_service", 
            "timing_belt", "air_filter", "battery", "other"
        ])
    ) [cite: 955-957]
    service_date = fields.DateTime(required=True)
    mileage_at_service = fields.Integer(required=True, validate=validate.Range(min=0))
    cost = fields.Float(required=False, allow_none=True, validate=validate.Range(min=0))
    service_provider = fields.String(required=False, allow_none=True)
    service_location = fields.String(required=False, allow_none=True)
    notes = fields.String(required=False, allow_none=True, validate=validate.Length(max=1000)) [cite: 2441]
    created_at = fields.DateTime(dump_only=True, default=datetime.utcnow)
    created_by = ObjectIdField(required=True)

class MaintenancePredictionSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    vehicle_id = ObjectIdField(required=True)
    maintenance_type = fields.String(required=True) 
    predicted_date = fields.DateTime(required=True)
    predicted_mileage = fields.Integer(required=True)
    calculated_at = fields.DateTime(dump_only=True, default=datetime.utcnow)
    last_notification_sent = fields.DateTime(required=False, allow_none=True)
    notification_status = fields.String(
        required=True,
        validate=validate.OneOf(["pending", "sent", "completed", "cancelled"]),
        default="pending"
    ) [cite: 2444]
    confidence_level = fields.Float(
        required=False, 
        allow_none=True, 
        validate=validate.Range(min=0.0, max=1.0)
    )
    is_active = fields.Boolean(default=True)

class AccidentHistorySchema(Schema):
    _id = ObjectIdField(dump_only=True)
    vehicle_id = ObjectIdField(required=True)
    accident_date = fields.DateTime(required=True)
    accident_location = fields.String(required=False, allow_none=True)
    description = fields.String(required=True, validate=validate.Length(max=2000)) [cite: 2446]
    estimated_cost = fields.Float(required=False, allow_none=True, validate=validate.Range(min=0))
    insurance_claim = fields.String(required=False, allow_none=True)
    police_report_number = fields.String(required=False, allow_none=True)
    severity = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(["minor", "moderate", "severe", "total_loss"])
    ) [cite: 2447]
    created_at = fields.DateTime(dump_only=True, default=datetime.utcnow)
    created_by = ObjectIdField(required=True)

# --- Workshops ---

class AddressSchema(Schema):
    street = fields.String(required=False, allow_none=True)
    city = fields.String(required=False, allow_none=True)
    region = fields.String(required=False, allow_none=True)
    postal_code = fields.String(required=False, allow_none=True)

class LocationSchema(Schema):
    type = fields.String(default="Point", validate=validate.OneOf(["Point"]))
    coordinates = fields.List(
        fields.Float(), 
        required=True, 
        validate=validate.Length(equal=2) # [longitude, latitude]
    )

class WorkshopSchema(Schema):
    _id = ObjectIdField(dump_only=True)
    name = fields.String(required=True)
    address = fields.Nested(AddressSchema, required=True)
    location = fields.Nested(LocationSchema, required=True) # GeoJSON
    phone_number = fields.String(required=False, allow_none=True)
    services_offered = fields.List(fields.String(), required=False, allow_none=True)
    operating_hours = fields.String(required=False, allow_none=True)
    average_rating = fields.Float(
        required=False, 
        allow_none=True, 
        validate=validate.Range(min=0, max=5)
    )
    created_at = fields.DateTime(dump_only=True, default=datetime.utcnow)
    updated_at = fields.DateTime(required=False, allow_none=True)
    is_active = fields.Boolean(default=True)

class SessionSchema(Schema):
    """
    Schema for the Sessions collection (managed by Flask-Session). [cite: 2452]
    """
    _id = fields.String(required=True)
    val = fields.Raw(required=True)
    expireAt = fields.DateTime(required=True)


user_schema = UserSchema()
vehicle_schema = VehicleSchema()
service_record_schema = ServiceRecordSchema()
maintenance_prediction_schema = MaintenancePredictionSchema()
accident_history_schema = AccidentHistorySchema()
workshop_schema = WorkshopSchema()
session_schema = SessionSchema()



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
        
        # Session Index
        db.sessions.create_index("expireAt", expireAfterSeconds=0)

        print("Database initialized and indexes ensured.")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
