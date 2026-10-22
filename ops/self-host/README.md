# Contabo/Linux self-host preparation

This directory contains templates, not an executed deployment. Public IP, host state,
SSH access, installed software and existing services must be inspected first.
No account credentials belong here.

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
   password change is needed, the user performs that interaction locally.
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
