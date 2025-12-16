from flask import Blueprint, render_template, session, redirect, url_for
from backend.models import db
from bson.objectid import ObjectId

web_bp = Blueprint('web_bp', __name__)

def get_current_user_role():
    user_id = session.get('user_id')
    if user_id:
        try:
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                return user.get('role', 'user')
        except:
            pass
    return None

# --- Routes ---

@web_bp.route('/')
def main_page():
    return render_template("Main_Page.html")

@web_bp.route('/dashboard')
def dashboard():
    role = get_current_user_role()
    if not role:
        return redirect(url_for('web_bp.login'))
    
    # FIX: Redirect Admin to Admin Dashboard
    if role == 'admin':
        return redirect(url_for('web_bp.admin_dashboard'))
        
    return render_template('dashboard.html', user_role=role)

@web_bp.route('/admin')
def admin_dashboard():
    role = get_current_user_role()
    # Security Check
    if role != 'admin':
        return redirect(url_for('web_bp.dashboard'))
    
    return render_template('admindashboard.html')

@web_bp.route('/login')
def login():
    return render_template('login.html')

@web_bp.route('/register')
def register():
    return render_template('register.html')

@web_bp.route('/vehicle-details')
def vehicle_details():
    role = get_current_user_role()
    return render_template('vehicledetails.html', user_role=role)

@web_bp.route('/workshops')
def workshops():
    role = get_current_user_role()
    return render_template('workshop.html', user_role=role)

@web_bp.route('/addvehicle')
def add_vehicle():
    role = get_current_user_role()
    return render_template('addvehicle.html', user_role=role)
