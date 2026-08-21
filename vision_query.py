import json
import subprocess
import sys

# Läs base64-bilden
with open('/tmp/box_image_b64.json', 'r') as f:
    data = json.load(f)

b64 = data['base64']

# Skapa request body
request = {
    "model": "qwen-vision-30b",
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{b64}"
                    }
                },
                {
                    "type": "text",
                    "text": "Analyze this 3D box design in detail. Describe the geometry, dimensions, and features. What are the strengths and weaknesses of this design? Are there any manufacturing or structural concerns? Be specific and detailed."
                }
            ]
        }
    ],
    "max_tokens": 2000
}

# Skriv till fil
with open('/tmp/vision_request.json', 'w') as f:
    json.dump(request, f)

print(f"Request written ({len(b64)} base64 chars)")

# Kör curl med @-fil
cmd = [
    "curl", "-s",
    "http://127.0.0.1:9292/v1/chat/completions",
    "-H", "Content-Type: application/json",
    "-H", "Authorization: Bearer sk-local",
    "-d", "@/tmp/vision_request.json"
]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
print(f"Exit code: {result.returncode}")
print(f"Stdout ({len(result.stdout)} chars): {result.stdout[:3000]}")
if result.stderr:
    print(f"Stderr: {result.stderr[:500]}")
