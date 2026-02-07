import os
import sys
import pandas as pd
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_file_system():
    print("🧪 Testing File System")
    print("=" * 50)
    
    # Test creating uploads directory
    uploads_dir = 'uploads'
    os.makedirs(uploads_dir, exist_ok=True)
    print(f"📁 Uploads directory: {uploads_dir}")
    print(f"📁 Absolute path: {os.path.abspath(uploads_dir)}")
    print(f"📁 Exists: {os.path.exists(uploads_dir)}")
    
    # Test creating a sample Excel file
    test_data = [
        {'Title': 'Test Product 1', 'Price': '₹999', 'Description': 'Test desc 1'},
        {'Title': 'Test Product 2', 'Price': '₹1499', 'Description': 'Test desc 2'},
    ]
    
    df = pd.DataFrame(test_data)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"test_{timestamp}.xlsx"
    filepath = os.path.join(uploads_dir, filename)
    
    # Save file
    df.to_excel(filepath, index=False)
    print(f"\n💾 Created test file: {filename}")
    print(f"📄 File path: {filepath}")
    print(f"📄 File exists: {os.path.exists(filepath)}")
    print(f"📄 File size: {os.path.getsize(filepath)} bytes")
    
    # List all files
    print(f"\n📂 Files in uploads directory:")
    for f in os.listdir(uploads_dir):
        f_path = os.path.join(uploads_dir, f)
        size = os.path.getsize(f_path)
        print(f"  - {f} ({size} bytes)")
    
    # Test Flask send_file
    print("\n🚀 Testing Flask send_file...")
    try:
        from flask import Flask, send_file
        app = Flask(__name__)
        
        with app.test_request_context():
            # This would work in Flask context
            print("✅ Flask app context ready")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Cleanup
    print("\n🧹 Cleanup test files...")
    for f in os.listdir(uploads_dir):
        if f.startswith('test_'):
            os.remove(os.path.join(uploads_dir, f))
            print(f"  Deleted: {f}")

if __name__ == "__main__":
    test_file_system()