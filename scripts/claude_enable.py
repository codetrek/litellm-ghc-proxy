#!/usr/bin/env python3
"""
Script to enable Claude Code proxy configuration.
Usage: claude_enable.py
"""
import json
import sys
import os
from pathlib import Path

def _load_master_key(env_path: Path) -> str:
    if not env_path.exists():
        print(f"❌ .env file not found at {env_path}")
        sys.exit(1)

    master_key = None
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            if key.strip() == 'LITELLM_MASTER_KEY':
                master_key = value.strip().strip('"')
                break

    if not master_key:
        print("❌ LITELLM_MASTER_KEY not found in .env")
        sys.exit(1)

    return master_key


def main():
    project_root = Path(__file__).resolve().parent.parent
    env_path = project_root / '.env'
    master_key = _load_master_key(env_path)
    claude_dir = Path.home() / '.claude'
    settings_file = claude_dir / 'settings.json'

    # Create .claude directory if it doesn't exist
    claude_dir.mkdir(exist_ok=True)

    # Load existing settings or create empty dict
    settings = {}
    if settings_file.exists():
        try:
            with open(settings_file, 'r') as f:
                settings = json.load(f)
        except (json.JSONDecodeError, IOError):
            settings = {}

    # Add proxy configuration
    settings['env'] = {
        'ANTHROPIC_AUTH_TOKEN': master_key,
        'ANTHROPIC_BASE_URL': 'http://localhost:4000',
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4.5",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4.5",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4.5",
        "ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-4.5",
    }

    # Add schema if it's a new file
    if '$schema' not in settings:
        settings['$schema'] = 'https://json.schemastore.org/claude-code-settings.json'

    # Save updated settings
    with open(settings_file, 'w') as f:
        json.dump(settings, f, indent=2)

    print('✅ Updated settings while preserving existing configuration')

if __name__ == '__main__':
    main()
