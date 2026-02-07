
import traceback
from app import create_app

try:
    app = create_app()
    print("✅ Flask app created successfully for run.py")
    if __name__ == '__main__':
        print("🚀 Starting Flask development server on host 0.0.0.0, port 8087...")
        # Using port 8087 as expected by the environment, with debug mode on.
        app.run(host='0.0.0.0', port=8087, debug=True)
except Exception as e:
    print(f"\n❌ Error starting app with run.py: {e}")
    print("\n🔍 Full traceback:")
    traceback.print_exc()
