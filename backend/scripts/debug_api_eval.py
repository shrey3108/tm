
import requests

stage_id = "019da3bb-007c-779b-835f-10d0bd4fd9b0"
url = f"http://localhost:8000/api/v1/transcripts/evaluation/{stage_id}"

response = requests.get(url)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    print(response.json())
else:
    print(response.text)
