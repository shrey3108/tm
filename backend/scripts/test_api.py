
import requests

try:
    url = "http://127.0.0.1:8000/api/v1/transcripts/evaluation/019da3bb-0072-7694-8e10-19d503ee068e"
    print(f"Testing URL: {url}")
    r = requests.get(url)
    print(f"Status Code: {r.status_code}")
    print(f"Response: {r.text[:500]}") # Only first 500 chars
except Exception as e:
    print(f"Request failed: {e}")
