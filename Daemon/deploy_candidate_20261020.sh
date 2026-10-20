#!/usr/bin/env bash
# One-time production rollout. Run on cbgpu as root after reviewing the staged files.
set -euo pipefail

if (( EUID != 0 )); then
  echo 'Run this script with sudo on the GPU server.' >&2
  exit 1
fi

dir=/home/cbgpu/CBGPU/Daemon
service=cbgpu-daemon.service
expected_sha=85ed5e029dff2e53b8a6f285389e2c5aa37917cc64f03fc5db3d8d3b2f31ff9f

cd "$dir"
test -f daemon.py.candidate-20261020
test -f config.yaml.candidate-20261020
printf '%s  %s\n' "$expected_sha" daemon.py.candidate-20261020 | sha256sum --check --status
python3 -m py_compile daemon.py.candidate-20261020
python3 - <<'PY'
import yaml
with open('config.yaml.candidate-20261020', encoding='utf-8') as f:
    cfg = yaml.safe_load(f)
assert cfg['docker']['school_bind_address'] == '10.138.23.12'
assert set(cfg['gpus']) == {1, 2, 3, 4}
PY

for id in 1 2 3 4; do
  docker inspect --format '{{.Id}}|{{.State.Running}}' "jupiterhub_gpu$id" > "/tmp/cbgpu-gpu${id}-before-20261020"
done

cp -p daemon.py daemon.py.before-20261020
cp -p config.yaml config.yaml.before-20261020
cp -p daemon.py.candidate-20261020 daemon.py
cp -p config.yaml.candidate-20261020 config.yaml

if ! systemctl restart "$service" || ! systemctl is-active --quiet "$service"; then
  cp -p daemon.py.before-20261020 daemon.py
  cp -p config.yaml.before-20261020 config.yaml
  systemctl restart "$service"
  echo 'Daemon startup failed; previous code and config restored.' >&2
  exit 2
fi

sleep 3
if ! systemctl is-active --quiet "$service"; then
  cp -p daemon.py.before-20261020 daemon.py
  cp -p config.yaml.before-20261020 config.yaml
  systemctl restart "$service"
  echo 'Daemon stopped after startup; previous code and config restored.' >&2
  exit 3
fi

for id in 1 2 3 4; do
  current=$(docker inspect --format '{{.Id}}|{{.State.Running}}' "jupiterhub_gpu$id")
  previous=$(cat "/tmp/cbgpu-gpu${id}-before-20261020")
  if [[ "$current" != "$previous" ]]; then
    echo "GPU $id container changed during daemon restart; inspect before further action." >&2
    exit 4
  fi
done

echo 'Daemon active; all GPU container IDs and running states unchanged.'
