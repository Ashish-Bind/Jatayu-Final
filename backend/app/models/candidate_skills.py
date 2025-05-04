from app import db

class CandidateSkill(db.Model):
    __tablename__ = 'candidate_skills'

    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.candidate_id'), primary_key=True)
    skill_id = db.Column(db.Integer, db.ForeignKey('skills.skill_id'), primary_key=True)
    proficiency = db.Column(db.Integer)

    def __repr__(self):
        return f'<CandidateSkill candidate_id={self.candidate_id} skill_id={self.skill_id} proficiency={self.proficiency}>'