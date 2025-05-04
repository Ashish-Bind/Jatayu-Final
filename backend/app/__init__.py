from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import os

db = SQLAlchemy()

def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key")

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

    db.init_app(app)

    # Import models
    from app.models.user import User
    from app.models.job import JobDescription, RequiredSkill
    from app.models.skill import Skill
    from app.models.mcq import MCQ

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.recruiter import recruiter_bp
    from app.routes.candidate import candidate_api_bp

    app.register_blueprint(candidate_api_bp)
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(recruiter_bp, url_prefix='/api/recruiter')

    return app