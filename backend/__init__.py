import os
from flask import Flask
from flask_session import Session
from flask_cors import CORS
from .models import initialize_database, db 
from .routes.auth import auth_bp
from .routes.history import history_bp
from .routes.vehicles import vehicles_bp
from datetime import timedelta
from .routes.web import web_bp
from .routes.predictions import predictions_bp
from .routes.workshops import workshops_bp

def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = "motarilog-secret-key-2024"
    app.config["SESSION_TYPE"] = "mongodb"
    app.config["SESSION_MONGODB"] = db.client
    app.config["SESSION_MONGODB_DB"] = "motarilog"
    app.config["SESSION_MONGODB_COLLECT"] = "sessions"
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=24) 

    upload_folder = os.path.join(app.root_path,'static','uploads')
    os.makedirs(upload_folder,exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_folder 
    
    CORS(app, supports_credentials=True)

    # Initialize Session
    Session(app)

    initialize_database()

    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(history_bp, url_prefix='/api')
    app.register_blueprint(vehicles_bp, url_prefix='/api')
    app.register_blueprint(predictions_bp, url_prefix='/api')
    app.register_blueprint(workshops_bp, url_prefix='/api')


    app.register_blueprint(web_bp)
    return app
