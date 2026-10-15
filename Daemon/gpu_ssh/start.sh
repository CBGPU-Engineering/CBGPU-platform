#!/bin/bash
set -e
mkdir -p /run/sshd /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
/usr/sbin/sshd -e
source /etc/bash.bashrc
exec jupyter notebook --notebook-dir=/tf --ip 0.0.0.0 --no-browser --allow-root
