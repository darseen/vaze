#!/bin/sh
# entrypoint.sh

# Rigorous check for an empty or unset JWT_SECRET
if [ -z "${JWT_SECRET}" ]; then
  echo ">>> JWT_SECRET is not set. Generating a temporary one-time secret..."
  # Generate a new secret and export it for the application process
  export JWT_SECRET=$(openssl rand -base64 32)
  echo ">>> A new secret has been generated for this container instance."
else
  echo ">>> Using existing JWT_SECRET provided by user."
fi

exec "$@"