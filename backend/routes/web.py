from flask import Blueprint, render_template

# Create the Blueprint
web_bp = Blueprint('web_bp', __name__)

# Define routes to serve your HTML files

@web_bp.route('/')
@web_bp.route('/dashboard')
def dashboard():
    return render_template('Dashboard.html')

@web_bp.route('/login')
def login():
    return render_template('login.html')

@web_bp.route('/register')
def register():
    return render_template('Register.html')

@web_bp.route('/vehicle-details')
def vehicle_details():
    return render_template('Vehicle-Details.html')

@web_bp.route('/workshops')
def workshops():
    return render_template('Workshops.html')
