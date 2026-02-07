import sys
import os
import traceback

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app import create_app
    app = create_app()
    print("✅ Flask app created successfully")
    
    # Test basic routes
    with app.test_client() as client:
        print("\n🧪 Testing routes:")
        
        # Test home page
        response = client.get('/')
        print(f"  GET / - Status: {response.status_code}")
        
        # Test dashboard
        response = client.get('/dashboard')
        print(f"  GET /dashboard - Status: {response.status_code}")
        
        # Test downloads list
        response = client.get('/downloads')
        print(f"  GET /downloads - Status: {response.status_code}")
        
        # Test collections
        response = client.get('/collections')
        print(f"  GET /collections - Status: {response.status_code}")
        
except Exception as e:
    print(f"\n❌ Error creating app: {e}")
    print("\n🔍 Full traceback:")
    traceback.print_exc()