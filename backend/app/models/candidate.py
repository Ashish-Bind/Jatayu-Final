from app import db
import uuid

class Candidate(db.Model):
    __tablename__ = 'candidates'

    candidate_id = db.Column(db.Integer, primary_key=True)
    unique_id = db.Column(db.String(36), default=lambda: str(uuid.uuid4()), nullable=False, unique=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    phone = db.Column(db.String(20), unique=True)
    location = db.Column(db.String(255))
    linkedin = db.Column(db.String(255), unique=True)
    github = db.Column(db.String(255), unique=True)
    degree = db.Column(db.String(100))
    years_of_experience = db.Column(db.Float)
    resume = db.Column(db.String(255))
    profile_picture = db.Column(db.String(255))
    is_profile_complete = db.Column(db.Boolean, default=False, nullable=False)

    def __repr__(self):
        return f'<Candidate {self.email}>'