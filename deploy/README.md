# Personal-site deployment

The existing jpentakalos.com nginx virtual host includes `nginx.conf` inside its server block. Install it as `/etc/nginx/snippets/fantasy-dashboard.conf`, validate with `nginx -t`, then reload nginx. DNS, TLS, and the main site's deploy workflow stay with the personal website.

`receive.py` is installed root-owned and executable at `/usr/local/bin/deploy-fantasy-dashboard.py`. The dedicated `fantasy-deploy` account owns only `/var/www/fantasy-dashboard`. Its authorized deploy key uses:

```text
restrict,command="/usr/local/bin/deploy-fantasy-dashboard.py" ssh-ed25519 <public key>
```

Keep `.ssh` and `authorized_keys` root-owned, respectively mode 755 and 644, so the deployment account cannot change its key restrictions. This account has no sudo access. Set a private key only in the repository's `DEPLOY_SSH_KEY` Actions secret, the server hostname/IP in `DEPLOY_HOST`, and the independently verified SSH host key in `DEPLOY_KNOWN_HOSTS`. Never commit private keys.

The GitHub Actions build is downloaded as a verified artifact and tarred on Linux, then piped into SSH. The server needs only Python 3 and nginx; no Node, pipeline runtime, source credentials, or scheduled jobs are needed there. Changes to the receiver or nginx snippet require an administrator to install them separately; application deploy credentials cannot change server configuration.

For an emergency manual deployment of an already verified local build (use `COPYFILE_DISABLE=1` on macOS to omit metadata):

```sh
COPYFILE_DISABLE=1 tar -czf /tmp/fantasy-dashboard.tar.gz -C web/dist .
ssh -i <restricted-deploy-key> fantasy-deploy@<host> < /tmp/fantasy-dashboard.tar.gz
```

To roll back as an administrator, select a validated directory under `/var/www/fantasy-dashboard/releases`, then atomically replace `current` with a relative symlink to that release. Pause the Actions workflow before an extended rollback so the next daily refresh does not replace it.

The receiver's tests cover successful replacement, retention of old assets, missing/corrupt data, mismatched snapshots, missing assets, path traversal, and symlinks. A failed validation never changes the public release.
