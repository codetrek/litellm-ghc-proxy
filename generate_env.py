#!/usr/bin/env python3
import os
import uuid

# Generate unique keys
master_key = f"litellm-{uuid.uuid4()}"
salt_key = f"litellm-{uuid.uuid4()}"

# Create .env file (do not overwrite if it already exists)
if os.path.exists('.env'):
    print('Skipped: .env already exists.')
else:
    with open('.env', 'w') as f:
        f.write(f'LITELLM_MASTER_KEY={master_key}\n')
        f.write(f'LITELLM_SALT_KEY={salt_key}\n')
        f.write('ENABLE_NETWORK_MONITOR=true\n')
        f.write('LOG_LEVEL=INFO\n')

    print(f'Master Key: {master_key}')
