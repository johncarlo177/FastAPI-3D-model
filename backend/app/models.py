from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class ModelRecord(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, nullable=False, index=True)
    filename = Column(String, nullable=False)
    extension = Column(String)
    file_path = Column(String, nullable=False)
    vertices_count = Column(Integer)
    triangles_count = Column(Integer)
    size_x = Column(Float)
    size_y = Column(Float)
    size_z = Column(Float)
    volume = Column(Float)
    surface_area = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
