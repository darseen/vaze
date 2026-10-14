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
  SERVICE_NAME=$(hostname)
  echo ">>> BASE_URL is not set. Defaulting to http://${SERVICE_NAME}:3000"
  export BASE_URL="http://${SERVICE_NAME}:3000"
else
  echo ">>> Using existing BASE_URL: ${BASE_URL}"
fi

# Refuse to start when DATA_PATH is on the container's own filesystem, which a redeploy wipes
DATA_DEVICE_PATH="${DATA_PATH}"
while [ ! -e "${DATA_DEVICE_PATH}" ]; do DATA_DEVICE_PATH=$(dirname "${DATA_DEVICE_PATH}"); done
if [ "${ALLOW_EPHEMERAL_DATA}" != "true" ] && [ "$(stat -c %d "${DATA_DEVICE_PATH}")" = "$(stat -c %d /)" ]; then
  echo ">>> ${DATA_PATH} is not on a mounted volume, so files and accounts would be lost when this container is replaced."
  echo ">>> Mount a volume at ${DATA_PATH}, or set ALLOW_EPHEMERAL_DATA=true to run without one."
  exit 1
fi

exec "$@"