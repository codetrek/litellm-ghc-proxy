# LiteLLM GitHub Copilot Proxy

Run a LiteLLM proxy configured for GitHub Copilot models via Docker Compose.

## Prerequisites

- Docker Engine and Docker Compose plugin
- Python 3 (to generate the .env file)
- curl
- jq (only required for listing models)

## Setup

1. Generate the .env file:

  ```bash
   python3 generate_env.py
  ```

2. Start the proxy once to get the GitHub device code:

  ```bash
  docker compose up -d
  ```

  Then read the logs and follow the device code login:

  ```bash
  docker logs -f ghc-proxy
  ```

  After login, the token will be saved to:

  litellm-data/github_copilot/access-token

3. (Optional) Adjust models in conf/copilot-config.yaml.

## Run

Start the proxy:

  docker compose up -d

Stop the proxy:

  docker compose down

The proxy listens on http://localhost:4000.

## Key Manager UI

Start the UI (included in docker compose):

  docker compose up -d

Open http://localhost:8000

Credentials are read from `.env`:
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Test

  ./test-proxy.sh

## List available Copilot models

  ./list-copilot-models.sh

Or only enabled models:

  ./list-copilot-models.sh --enabled-only

## Claude Code (optional)

Enable proxy settings for Claude Code:

  python3 scripts/claude_enable.py

Disable proxy settings:

  python3 scripts/claude_disable.py
