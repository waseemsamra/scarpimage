import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-12345-change-in-production'
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
