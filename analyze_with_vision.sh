#!/bin/bash
# Analyze parametric box render with Qwen3-VL-235b

cd /home/thn/ai/pCAD

# Get API key
API_KEY=$(grep -A1 'openrouter:' ~/.hermes/config.yaml 2>/dev/null | grep 'api_key' | sed 's/.*: *//' | tr -d ' \t\n\r')

if [ -z "$API_KEY" ] || [[ "$API_KEY" == "sk-loc"* ]]; then
    echo "ERROR: No valid OpenRouter API key found"
    echo "Current config api_key field:"
    grep -A1 'openrouter:' ~/.hermes/config.yaml 2>/dev/null | head -5
    exit 1
fi

echo "Using API key: ${API_KEY:0:10}..."

# Base64 encode the image
IMG_BASE64=$(base64 -w0 /home/thn/ai/pCAD/parametric_box_render.png)

# Send to Qwen3-VL-235b
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: http://localhost:8888" \
  -H "X-Title: Hermes-OpenSCAD-Vision" \
  -d "{
    \"model\": \"qwen/qwen3-vl-235b-a22b-instruct\",
    \"messages\": [{
      \"role\": \"user\",
      \"content\": [
        {\"type\": \"text\", \"text\": \"Analyze this 3D CAD render of a parametric box. Specifications: 100x60x30mm, 2mm wall thickness, 4mm corner radius, should be HOLLOW with walls. Check proportions, hollow nature, rounded corners, overall quality. Be technical and specific. Return only your analysis, no code blocks.\"},
        {\"type\": \"image_url\", \"image_url\": {\"url\": \"data:image/png;base64,$IMG_BASE64\"}}
      ]
    }],
    \"max_tokens\": 2000,
    \"temperature\": 0.1
  }" 2>&1 | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'choices' in data:
        print(data['choices'][0]['message']['content'])
    else:
        print('ERROR:', json.dumps(data, indent=2))
except:
    print('PARSE ERROR')
    sys.stdin.seek(0)
    print(sys.stdin.read()[:500])
"
