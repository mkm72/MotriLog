from flask import Blueprint, render_template

# Create the Blueprint
web_bp = Blueprint('web_bp', __name__)

# Define routes to serve your HTML files

@web_bp.route('/')
def main_page():
    return render_template("Main_Page.html")
@web_bp.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@web_bp.route('/login')
def login():
    return render_template('login.html')

@web_bp.route('/register')
def register():
    return render_template('register.html')

@web_bp.route('/vehicle-details')
def vehicle_details():
    return render_template('vehicledetails.html')

@web_bp.route('/workshops')
def workshops():
    return render_template('workshop.html')

@web_bp.route('/addvehicle')
def add_vehicle():
    return render_template('/addvehicle.html')
