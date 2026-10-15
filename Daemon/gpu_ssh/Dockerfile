FROM tensorflow/tensorflow:latest-gpu-jupyter

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssh-server \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/sshd /root/.ssh /etc/ssh/hostkeys \
    && rm -f /etc/ssh/ssh_host_*_key /etc/ssh/ssh_host_*_key.pub \
    && chmod 700 /root/.ssh \
    && printf '%s\n' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' \
       'PermitRootLogin prohibit-password' 'PubkeyAuthentication yes' \
       'PermitEmptyPasswords no' 'AuthorizedKeysFile .ssh/authorized_keys' \
       'HostKey /etc/ssh/hostkeys/ssh_host_ed25519_key' 'HostKeyAlgorithms ssh-ed25519' \
       > /etc/ssh/sshd_config.d/cbgpu.conf

COPY start.sh /usr/local/bin/cbgpu-gpu-start
RUN chmod 755 /usr/local/bin/cbgpu-gpu-start
EXPOSE 22 8888
CMD ["/usr/local/bin/cbgpu-gpu-start"]
