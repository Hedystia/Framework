#!/bin/bash
set -euo pipefail

cd /home/runner/actions-runner

until docker version; do
  echo "Waiting for native Docker socket access..."
  sleep 2
done

if [ ! -f ".runner" ]; then
  echo "Registering runner for the first time..."
  ./config.sh \
    --url https://github.com/Hedystia/Hedystia \
    --token "${RUNNER_TOKEN}" \
    --name "actions" \
    --unattended \
    --replace
else
  echo "Runner already configured. Skipping registration."
fi

./run.sh
