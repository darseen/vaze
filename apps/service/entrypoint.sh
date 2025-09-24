#!/bin/sh
# entrypoint.sh

# Rigorous check for an empty or unset AUTH_SECRET
if [ -z "${AUTH_SECRET}" ]; then
  echo ">>> AUTH_SECRET is not set. Generating a temporary one-time secret..."
  # Generate a new secret and export it for the application process
  export AUTH_SECRET=$(openssl rand -base64 32)
  echo ">>> A new secret has been generated for this container instance."
else
  echo ">>> Using existing AUTH_SECRET provided by user."
fi

# Check for BASE_URL, default if not set
if [ -z "${BASE_URL}" ]; then
  echo ">>> BASE_URL is not set. Defaulting to http://127.0.0.1:3000"
  export BASE_URL="http://127.0.0.1:3000"
else
  echo ">>> Using existing BASE_URL: ${BASE_URL}"
fi

exec "$@"