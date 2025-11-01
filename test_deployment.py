#!/usr/bin/env python3
"""Test script to verify Northflank deployment"""

import requests
import json
import sys
from datetime import datetime

def test_deployment(base_url):
    """Test the deployed application endpoints"""
    
    print(f"Testing deployment at: {base_url}")
    print("=" * 50)
    
    tests = [
        {
            "name": "Health Check",
            "endpoint": "/health",
            "method": "GET"
        },
        {
            "name": "Landing Page",
            "endpoint": "/",
            "method": "GET"
        },
        {
            "name": "Main App",
            "endpoint": "/app",
            "method": "GET"
        },
        {
            "name": "Admin Portal",
            "endpoint": "/admin",
            "method": "GET"
        }
    ]
    
    results = []
    
    for test in tests:
        try:
            url = f"{base_url}{test['endpoint']}"
            response = requests.get(url, timeout=10)
            
            status = "PASS" if response.status_code == 200 else f"FAIL ({response.status_code})"
            
            result = {
                "test": test["name"],
                "url": url,
                "status_code": response.status_code,
                "success": response.status_code == 200,
                "response_time": response.elapsed.total_seconds()
            }
            
            if test["endpoint"] == "/health":
                try:
                    health_data = response.json()
                    result["health_data"] = health_data
                except:
                    result["health_data"] = "Invalid JSON response"
            
            results.append(result)
            
            print(f"{status} {test['name']}: {url} ({response.elapsed.total_seconds():.2f}s)")
            
        except requests.exceptions.RequestException as e:
            result = {
                "test": test["name"],
                "url": url,
                "status_code": None,
                "success": False,
                "error": str(e)
            }
            results.append(result)
            print(f"FAIL {test['name']}: {url} - {e}")
    
    print("\n" + "=" * 50)
    print("SUMMARY:")
    
    passed = sum(1 for r in results if r.get("success", False))
    total = len(results)
    
    print(f"Tests Passed: {passed}/{total}")
    
    if passed == total:
        print("All tests passed! Deployment is working correctly.")
    else:
        print("Some tests failed. Check the logs above for details.")
    
    # Print health check details if available
    health_result = next((r for r in results if r["test"] == "Health Check"), None)
    if health_result and health_result.get("health_data"):
        print(f"\nHealth Check Response: {health_result['health_data']}")
    
    return results

def main():
    if len(sys.argv) != 2:
        print("Usage: python test_deployment.py <base_url>")
        print("Example: python test_deployment.py https://your-app.northflank.app")
        sys.exit(1)
    
    base_url = sys.argv[1].rstrip('/')
    
    print(f"Deployment Test - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target URL: {base_url}")
    print()
    
    results = test_deployment(base_url)
    
    # Save results to file
    with open('deployment_test_results.json', 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "base_url": base_url,
            "results": results
        }, f, indent=2)
    
    print(f"\nResults saved to: deployment_test_results.json")

if __name__ == "__main__":
    main()