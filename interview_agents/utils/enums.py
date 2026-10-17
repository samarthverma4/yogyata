from enum import Enum


class DifficultyLevel(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class QuestionCategory(str, Enum):
    TECHNICAL = "Technical"
    BEHAVIORAL = "Behavioral"
    HR = "HR"
    PROBLEM_SOLVING = "Problem Solving"
    SVAR = "SVAR"
    PSYCHOMETRIC = "Psychometric"


class InterviewType(str, Enum):
    """Types of interviews supported by GLAMIS"""
    SUBJECT = "subject"
    VERBAL = "verbal"
    WRITTEN = "written"
    COMPANY = "company"
    SVAR = "svar"
    HR = "hr"
    SYSTEM_DESIGN = "system_design"
    PSYCHOMETRIC = "psychometric"


class PsychometricPillar(str, Enum):
    """The 10 golden workplace pillars scored across a psychometric assessment."""
    COMMUNICATION = "communication"
    TEAMWORK = "teamwork"
    LEADERSHIP = "leadership"
    PROBLEM_SOLVING = "problem_solving"
    DECISION_MAKING = "decision_making"
    ADAPTABILITY = "adaptability"
    EMOTIONAL_STABILITY = "emotional_stability"
    CONSCIENTIOUSNESS = "conscientiousness"
    INTEGRITY = "integrity"
    LEARNING_AGILITY = "learning_agility"


class PsychometricResponseType(str, Enum):
    """The 13 candidate response-format types the frontend renders."""
    LIKERT = "likert"
    FREQUENCY = "frequency"
    AGREEMENT = "agreement"
    IMPORTANCE = "importance"
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_SELECT = "multiple_select"
    FORCED_CHOICE = "forced_choice"
    RANKING = "ranking"
    SJT = "sjt"
    SCENARIO_RATING = "scenario_rating"
    YES_NO = "yes_no"
    TRUE_FALSE = "true_false"
    OPEN_ENDED = "open_ended"


class SubjectType(str, Enum):
    """Subject types for subject-based interviews"""
    DSA = "dsa"
    OS = "os"  # Operating System
    CN = "cn"  # Computer Networks
    DBMS = "dbms"
    ML = "ml"  # Machine Learning
    CYBERSECURITY = "cybersecurity"
    CLOUD_COMPUTING = "cloud_computing"
    WEB_DEVELOPMENT = "web_development"
    JAVA = "java"
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    CPP = "cpp"


class SVARType(str, Enum):
    """SVAR interview types"""
    READING = "reading"
    REPEATING = "repeating"
    JUMBLED_SENTENCE = "jumbled_sentence"
    SHORT_QUESTION = "short_question"
    COMPREHENSION = "comprehension"
