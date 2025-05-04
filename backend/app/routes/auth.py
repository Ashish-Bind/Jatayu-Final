# app/routes/auth.py
from flask import Blueprint, request, jsonify, session
from app import db
from app.models.user import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup',  methods=['POST'])
def signup():
    data = request.json
    print(data)
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'User already exists'}), 400

    user = User(
        name=data['name'],
        email=data['email'],
        role='candidate'  # Signup allowed only for candidates
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'Signup successful'}), 200

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    if user and user.check_password(data['password']):
        session['user_id'] = user.id
        session['role'] = user.role
        return jsonify({'message': 'Login successful', 'role': user.role})
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/check')
def check_auth():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role
                }
            })
    return jsonify({'error': 'Not authenticated'}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'})
