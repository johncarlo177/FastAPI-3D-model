from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Database setup
DATABASE_URL = "postgresql+psycopg2://threeuser:123456@localhost:5432/threemodel"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Static folder setup
STATIC_ROOT = BASE_DIR / "static" / "models"
STATIC_ROOT.mkdir(parents=True, exist_ok=True)

# CORS setup
CORS_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080"
]
