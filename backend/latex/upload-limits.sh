#!/bin/sh
set -eu
# CBGPU handles authenticated ZIP imports; remove CE's duplicate upload caps.
sed -i 's/client_max_body_size 50m;/client_max_body_size 0;/' /etc/nginx/nginx.conf
if ! grep -q 'CBGPU_UPLOAD_SIZE_POLICY' /etc/overleaf/settings.js; then
  printf '\n// CBGPU_UPLOAD_SIZE_POLICY\nmodule.exports.maxUploadSize = Number.POSITIVE_INFINITY;\n' >> /etc/overleaf/settings.js
fi
# The history blob endpoint has its own 50 MiB limit, separate from web uploads.
sed -i "s/const maxUploadSize = parseInt(config.get('maxFileUploadSize'), 10)/const maxUploadSize = Number.POSITIVE_INFINITY/" /overleaf/services/history-v1/api/controllers/projects.js
