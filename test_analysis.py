
import sys
import os
import json

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("🧪 Testing Website Analysis")
print("=" * 50)

try:
    # Test 1: Test scraper directly
    print("1. Testing scraper analysis directly...")
    from app.scraper import GenericScraper  # Corrected class name
    
    scraper = GenericScraper()
    analysis = scraper.analyze_structure("https://sanaullastore.com")
    
    print(f"   Platform: {analysis.get('platform')}")
    print(f"   Product links: {analysis.get('product_links_count')}")
    print(f"   Selectors found: {len(analysis.get('selectors_found', []))}")
    print("   ✅ Direct analysis successful")
    
    # Test 2: Test Flask endpoint
    print("\n2. Testing Flask analysis endpoint...")
    from app import create_app
    
    app = create_app()
    with app.test_client() as client:
        response = client.post('/analyze-selectors', 
                             json={'url': 'https://sanaullastore.com'},
                             content_type='application/json')
        
        data = json.loads(response.data)
        print(f"   Status code: {response.status_code}")
        print(f"   Success: {data.get('success')}")
        
        if data.get('success'):
            analysis_data = data.get('analysis', {})
            print(f"   Platform: {analysis_data.get('platform')}")
            print(f"   Product links: {analysis_data.get('product_links_count')}")
            print("   ✅ Flask endpoint working")
        else:
            print(f"   ❌ Error: {data.get('error')}")
    
    print("\n" + "=" * 50)
    print("✅ Analysis tests completed!")
    
except Exception as e:
    print(f"\n❌ Test failed: {e}")
    import traceback
    traceback.print_exc()
