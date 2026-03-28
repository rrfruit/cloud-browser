#!/bin/sh
set -eu
# s6 longrun: uid/gid must be plain numeric files (not executable), written after USER_ID is set.
printf '%s\n' "${USER_ID:-1000}" >/etc/services.d/cloud-browser/uid
printf '%s\n' "${GROUP_ID:-1000}" >/etc/services.d/cloud-browser/gid
chmod 644 /etc/services.d/cloud-browser/uid /etc/services.d/cloud-browser/gid
