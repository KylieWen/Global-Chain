# Contabo/Linux self-host operations

The first deployment was completed on 2026-10-23 (Asia/Singapore):
[public world map](http://62.171.148.193/map), using application commit
`b7f2f4201dcd23cfa2694e99c24f50062099b8ff`. This is IP-based HTTP; no domain
or HTTPS is configured. No account credentials belong here.

The current application is `e7c09af2de182905ac9808385b81689a3515d833`, including
five source-backed industry networks (259 topics, 292 relations and 24 organizations),
the optional personalized first-visit guide, retired standalone demo entry,
three browsing perspectives, and the China navigation/metadata fixes. It retains the China atlas 2026.10.2
(18 roles, 12 representative connections). The current release directory is
`/opt/globechain/releases/e7c09af2de18`; the immediately preceding verified release
`/opt/globechain/releases/39ee82f4775b` and older releases remain available for rollback.
The homepage at [the public root](http://62.171.148.193/) offers a skippable first-visit
guide and a button to reopen it. `/demo` redirects there. Printable booth QR assets
are in `output/booth/2026-10-24/`; the PNG and SVG independently decode to this root.

The templates support future installations; inspect each host before applying them.
The actual host uses Ubuntu 24.04, Node v24.22.1 and the pinned pnpm 11.19.0.
The current release is selected by `/opt/globechain/current`.
The unprivileged `globechain` systemd service runs Next.js
on `127.0.0.1:3000`; nginx serves public port 80. Both services are enabled.
The separate nginx site is `/etc/nginx/sites-available/globechain`; the package's
default site and existing SSH access were preserved. This deployment does not add
accounts, contributor submissions, enterprise applications or a database.

See [deployment evidence and limits](../../docs/reviews/2026-10-23-contabo-deployment.md).
From the repository root, `node scripts/verify-self-host.mjs` checks the public site
using installed Chrome. Set `REVIEW_BASE_URL` to check another host.
`node scripts/verify-booth-onboarding.mjs` verifies fresh visits, skip/reopen,
personalized destinations, keyboard focus and mobile/restricted-storage behavior.

## Maintenance on the host

Use `systemctl status globechain nginx` and `journalctl -u globechain -n 100 --no-pager`
to inspect service health. `systemctl restart globechain` restarts the app after an
intentional release switch. Run `nginx -t` before `systemctl reload nginx`.
The Node executable is `/usr/local/bin/node`, linked to `/opt/node-v24.22.1-linux-x64`;
pnpm is linked from `/opt/globechain/tooling/bin/pnpm`.

For an update, build a new release, verify it temporarily on loopback port 3001,
then switch `current` and restart the app. Keep the prior release. To roll back,
point `current` back to that verified directory and restart; recheck health and the
public map. The initial `b7f2f4201dcd` release remains available as a rollback target.
Release activation is manual; CI does not deploy automatically.

## Source artifact

From the repository root, run `node scripts/package-self-host.mjs`. It archives only
committed application code, workspace manifests, content and published research releases.
Original downloaded source captures, generated builds, dependencies, all output folders, private checkout screenshots, user
documents, downloaded files and SSH credentials are outside the whitelist. Changed
application files must first be reviewed and committed. The artifact manifest records
the exact commit and SHA-256; an archive is not evidence that a server is ready or deployed.

The supplied package is source code. Build on Linux with the lockfile; do not upload
Windows node_modules or only the Windows .next directory. The application reads files
at runtime, so preserve the whole archived directory structure.

The packager validates all included manifest/fixture checksums. One historical smartphone
2023.3 release was normalized to LF in Git while its published checksum records CRLF.
Only inside the artifact copy, the packager restores CRLF if and only if the bytes match
that existing checksum exactly. It does not edit the repository or change the release hash.
Any other mismatch aborts packaging. The output manifest records this byte restoration.

## Host inspection and installation sequence

1. Obtain the VPS address and username from the provider's provisioning email or panel.
   Establish SSH using the user's existing credentials; inspect `/etc/os-release`,
   `uname -m`, memory/disk, `command -v node`, `node --version`, `command -v pnpm`,
   listening ports, running services, existing web/proxy configuration and firewall.
   Do not reinstall the server or stop unrelated services.
2. Confirm the host SSH fingerprint against trusted provider/console information where
   available. Never bypass host-key mismatch warnings. If password entry or first-login
   password change is needed, use the authentication method currently authorized by
   the user. Never store credentials in scripts, artifacts, logs or Git.
3. Reuse a compatible supported Node LTS, or install from an official source after
   verifying release checksums. Obtain the package manager version declared by the
   artifact. Install ordinary host dependencies only as required; no database is needed.
4. Transfer the archive plus checksum, verify the checksum on the host, extract into
   a new `/opt/globechain/releases/<commit>` directory. Leave any existing release intact.
   Use a dedicated unprivileged `globechain` service user; review directory ownership.
5. Run `pnpm install --frozen-lockfile` at the release root and `pnpm build` with
   `NEXT_TELEMETRY_DISABLED=1`. Build does not need provider passwords or API keys.
6. Start the candidate on loopback port 3001; verify `/api/health`, five product pages,
   world and China maps, historical versions and research exports before switching.
   Check server logs as well as HTTP statuses.
7. Set `current` to the verified release, adapt the systemd template to the actual Node
   executable, then enable/start it. Inspect any existing service of the same name first.
   The app binds only to 127.0.0.1; keep port 3000 private.
8. Render the nginx template using the real public address/domain. Add a separate site,
   test nginx configuration, reload and verify externally. Preserve existing sites and
   SSH access. If a domain is supplied and DNS resolves to this VPS, configure HTTPS
   using an official ACME client. Do not claim HTTPS is ready merely because HTTP works.
9. Recheck the live world/China map interaction and exports from a real browser. Record
   the live URL, deployed commit, service status and HTTPS status. If the candidate fails,
   keep or restore the previous `current` target; do not delete previous releases.

## Sources checked 2026-10-23

- [Contabo provisioning/login email](https://help.contabo.com/en/support/solutions/articles/103000253457-where-can-i-find-my-server-login-details-)
- [Next.js self-hosting/reverse proxy](https://nextjs.org/docs/app/guides/self-hosting)
- [Official Node LTS binaries and checksums](https://nodejs.org/download/release/latest-v24.x/)
