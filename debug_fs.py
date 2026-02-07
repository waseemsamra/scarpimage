import os
import sys
from datetime import datetime

def debug_file_system():
    print("🔍 Debugging File System")
    print("=" * 60)
    
    # Current working directory
    print(f"📁 Current directory: {os.getcwd()}")
    
    # Check if uploads directory exists
    uploads_dir = 'uploads'
    print(f"\n📁 Looking for uploads directory: {uploads_dir}")
    print(f"📁 Exists: {os.path.exists(uploads_dir)}")
    print(f"📁 Absolute path: {os.path.abspath(uploads_dir)}")
    
    if os.path.exists(uploads_dir):
        print(f"\n📂 Contents of uploads directory:")
        for item in os.listdir(uploads_dir):
            item_path = os.path.join(uploads_dir, item)
            if os.path.isfile(item_path):
                size = os.path.getsize(item_path)
                modified = datetime.fromtimestamp(os.path.getmtime(item_path))
                print(f"  📄 {item} ({size} bytes, modified: {modified})")
            else:
                print(f"  📁 {item}/")
    else:
        print("\n❌ Uploads directory does not exist!")
        print("   Creating uploads directory...")
        os.makedirs(uploads_dir, exist_ok=True)
        print("   ✅ Created uploads directory")
    
    # Check Flask app path
    print(f"\n🚀 Flask paths:")
    try:
        from flask import Flask
        app = Flask(__name__)
        print(f"  App root path: {app.root_path}")
        print(f"  App instance path: {app.instance_path}")
    except Exception as e:
        print(f"  Error: {e}")
    
    # Test file permissions
    print(f"\n🔐 Testing file permissions:")
    test_file = os.path.join(uploads_dir, 'test.txt')
    try:
        with open(test_file, 'w') as f:
            f.write('Test content')
        print(f"  ✅ Can write to uploads directory")
        os.remove(test_file)
        print(f"  ✅ Can delete from uploads directory")
    except Exception as e:
        print(f"  ❌ Cannot write to uploads directory: {e}")

if __name__ == "__main__":
    debug_file_system()
