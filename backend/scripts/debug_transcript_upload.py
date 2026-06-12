
import httpx
import asyncio
import os

async def test_upload():
    # Ensure uvicorn is running on port 8000
    url = "http://127.0.0.1:8000/api/v1/transcripts/upload"
    
    # Using the candidate ID we found earlier (Sameer Joshi)
    candidate_id = "019daae7-1736-7244-b6b1-e0a529e68cc3"
    
    # Path to an existing docx file to use for testing
    docx_path = r"C:\Users\harsh\Desktop\hiring_platform2\hiring-platform\uploads\resumes\019d2983-b4fd-754c-b0d3-0a42e12add36\019d3e37-bb06-7769-bbef-b86bb27b53d7\019d3e37-bb14-73e3-b1a1-5fecf516aeca.docx"
    
    if not os.path.exists(docx_path):
        print(f"Error: Test docx file not found at {docx_path}")
        return

    print(f"Uploading transcript for candidate {candidate_id}...")
    
    with open(docx_path, "rb") as f:
        files = {
            "file": ("test_transcript.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        }
        data = {
            "candidate_id": candidate_id
        }
        
        async with httpx.AsyncClient() as client:
            try:
                # Increase timeout as processing (cleaning/embedding) might take time
                response = await client.post(url, data=data, files=files, timeout=60.0)
                print(f"Status Code: {response.status_code}")
                import json
                print(json.dumps(response.json(), indent=2))
            except Exception as e:
                print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_upload())
