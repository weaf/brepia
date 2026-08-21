# ═══════════════════════════════════════════════════════════
# OpenCode Model Integration for Hermes Agent
# Skapad: 2026-08-18
# ═══════════════════════════════════════════════════════════

## STEG 1: Starta bridge-appen (gör detta EN gång)

Bridge-appen har redan skapats:
  ~/.hermes/plugins/opencode-openai-bridge.js

Den lyssnar på http://127.0.0.1:3131

Du behöver starta den så att den är igång när du använder opencode-modeller:

  # Starta i bakgrunden (terminal):
  nohup node ~/.hermes/plugins/opencode-openai-bridge.js --port 3131 > ~/.hermes/logs/opencode-bridge.log 2>&1 &
  
  # Eller använd systemctl/service om du vill att den ska starta automatiskt

## STEG 2: Lägg till opencode custom_provider i config.yaml

Öppna ~/.hermes/config.yaml och LÄGG TILL detta block direkt EFTER 
dqhermes-providerblocket (efter raden med "- qwen3.6-35b-mtp-96k"):

```yaml
  - name: opencode
    base_url: http://127.0.0.1:3131/v1
    api_key: opencode
    api_mode: chat_completions
    models:
      # opencode native models
      - opencode/big-pickle
      - opencode/deepseek-v4-flash-free
      - opencode/hy3-free
      - opencode/laguna-s-2.1-free
      - opencode/mimo-v2.5-free
      - opencode/nemotron-3-ultra-free
      - opencode/nemotron-3.5-lightning-free
      # google models
      - google/gemini-2.5-flash
      - google/gemini-2.5-pro
      - google/gemini-3.5-flash
      - google/gemini-3.6-flash
      - google/gemini-3.7-flash
      - google/gemini-3.1-flash-image
      - google/gemini-3.1-pro-preview
      - google/gemma-4-31b-it
      - google/gemini-2.5-computer-use-preview-10-2025
      # llama-swap models (local qwen)
      - llama-swap/qwen-coder-64k
      - llama-swap/qwen-coder-96k
      - llama-swap/qwen-coder-128k
      - llama-swap/qwen-coder-262k
      - llama-swap/qwen3.6-35b-64k
      - llama-swap/qwen3.6-35b-96k
      - llama-swap/qwen3.6-35b-128k
      - llama-swap/qwen3.6-35b-262k
      - llama-swap/qwen3.6-35b-mtp-64k
      - llama-swap/qwen3.6-35b-mtp-96k
      - llama-swap/qwen3.6-35b-mtp-128k
      - llama-swap/qwen3.6-35b-mtp-262k
      - llama-swap/qwen-default
      - llama-swap/qwen-research
      - llama-swap/qwen-research-mtp
      # morph models
      - morph/morph-v3-fast
      - morph/morph-v3-large
      - morph/auto
      # ollama-cloud models
      - ollama-cloud/kimi-k2.5
      - ollama-cloud/kimi-k2.6
      - ollama-cloud/kimi-k2.7-code
      - ollama-cloud/kimi-k3
      - ollama-cloud/deepseek-v4-flash
      - ollama-cloud/deepseek-v4-pro
      - ollama-cloud/glm-5.1
      - ollama-cloud/glm-5.2
      - ollama-cloud/minimax-m2.5
      - ollama-cloud/minimax-m2.7
      - ollama-cloud/minimax-m3
      - ollama-cloud/nemotron-3-ultra
      - ollama-cloud/qwen3.5:397b
      # openrouter models (toppvalda)
      - openrouter/anthropic/claude-opus-4
      - openrouter/anthropic/claude-opus-4.7
      - openrouter/anthropic/claude-sonnet-4
      - openrouter/anthropic/claude-sonnet-4.5
      - openrouter/anthropic/claude-sonnet-4.6
      - openrouter/anthropic/claude-sonnet-5
      - openrouter/anthropic/claude-opus-5
      - openrouter/openai/gpt-5-pro
      - openrouter/openai/gpt-5.6-terra
      - openrouter/openai/gpt-5.6-terra-pro
      - openrouter/openai/gpt-5.6-sol
      - openrouter/openai/gpt-5.6-sol-pro
      - openrouter/openai/gpt-4o
      - openrouter/openai/gpt-5
      - openrouter/google/gemini-2.5-pro
      - openrouter/google/gemini-3.5-flash
      - openrouter/google/gemini-3.7-flash
      - openrouter/qwen/qwen3-coder
      - openrouter/qwen/qwen3-max
      - openrouter/deepseek/deepseek-v4-flash
      - openrouter/moonshotai/kimi-k2.6
      - openrouter/mistralai/mistral-large-2512
```

**Exakt var i config.yaml** (hitta raden med `known_builtin_toolsets:` och lägg OPÅ 
detta block innan den, direkt efter `known_builtin_toolsets:`-sektionen):

```yaml
known_builtin_toolsets:
  ...
plugins:
  enabled:
    - opencode-cli
  disabled: []
  entries:
    opencode-cli:
      allow_tool_override: false
```

**INTE** — lägg det INNAN `known_builtin_toolsets:` och EFTER `custom_providers:`-blocket.

## STEG 3: Starta om Hermes

```bash
hermes restart
```

## STEG 4: Testa med /model picker

Nu ska opencode-modellerna dyka upp när du kör `/model` eller `/model picker`!

## STEG 5: (Valfritt) Lägg till fler modeller

Om du vill ha ALLA 435 opencode-modeller istället för urvalet:

1. Kör `curl -s http://127.0.0.1:3131/v1/models | python3 -m json.tool` för att få
   alla modell-ID:n
2. Ersätt modellistan i opencode-provider-blocket med alla ID:n

## Arkitekturöversikt

```
Hermes Agent
    │
    ├── /model picker visar:
    │   ├── dqhermes/* (befintliga)
    │   └── opencode/* ← NYA! (via bridge)
    │
    └── När du väljer en opencode-modell:
        │
        ├── Hermes skickar OpenAI-compatible request
        │   → POST http://127.0.0.1:3131/v1/chat/completions
        │   { model: "opencode/big-pickle", messages: [...] }
        │
        ├── Bridge-appen (opencode-openai-bridge.js)
        │   ├── Omvandlar till opencode run --format json
        │   ├── Kör: opencode run -m <model>
        │   └── Returnerar OpenAI-compatible response
        │
        └── Opencode CLI
            └── Skickar request till rätt provider
                (Google, OpenRouter, Ollama, etc.)
```

## Filerna som skapades

1. `~/.hermes/plugins/opencode-openai-bridge.js` — Bridge-app (Node.js)
   - Lyssnar på port 3131
   - GET /v1/models — returnerar alla opencode-modeller
   - POST /v1/chat/completions — skickar requests till opencode CLI

## Att tänka på

- **OpenCode CLI** måste vara installerad och fungera (`opencode --version`)
- Bridge-appen måste vara igång när du vill använda opencode-modeller
- Vissa opencode-modeller (som free-modeller) kräver inga API-nycklar
- Betalmodeller (t.ex. Claude Opus, GPT-5 Pro) kräver att OpenCode har
  rätt API-nycklar konfigurerade (OPENROUTER_API_KEY, etc.)
- Bridge-appen skickar requests via `opencode run --format json` som
  är synkron — förvänta dig lite latency (~2-5 sekunder för korta svar)
