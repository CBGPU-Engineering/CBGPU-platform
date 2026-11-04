# Running CBGPU for another school

First try the local demo. A production fork is a multi-service deployment, not a
single Next.js process. The current production host is not an installable image.

## Configure the fork

In a separate checkout, copy and edit the public configuration:

```bash
cp config/school.example.json config/school.json
node scripts/configure-school.mjs config/school.json
# Review the proposed paths, then apply to this checkout:
node scripts/configure-school.mjs config/school.json --write
git diff
```

The tool replaces the default domain (including subdomains), school name, contact
email, official school API hostname and installation root in tracked first-party
source and service templates. It leaves environment variable identifiers,
lockfiles, binary assets, vendor files and license texts intact. It is a source
configuration step, not a DNS editor or service installer. Never run it in the
live checkout. Review the changes and run tests before deploying.

`config/school.json` is local and ignored. Keep secrets in environment files,
not this configuration. The CBGPU project name and API identifiers intentionally
remain stable; replace brand assets manually if required by your fork.

## Bring your own services

- Generate your own Supabase keys and encryption secrets; initialize the schema,
  migrations, buckets and role policies. Do not copy the school's accounts or keys.
- Configure DNS, Cloudflare Tunnel or another HTTPS proxy, OAuth callback URLs,
  allowed origins and certificates for each service. Nested deployment names need
  appropriate certificate coverage.
- Replace the tracked public Firebase client configuration with your own project's
  app configuration; provision server credentials privately. Public Firebase keys
  do not grant authorization, but a fork must not send traffic to the school project.
- Configure your own email provider/domain, sender and recovery redirect URLs.
- Set GPU hosts, device/container mappings, storage paths, resource quotas and
  backup destinations for your hardware. Historical defaults include school-local
  IPs; they are not portable discovery mechanisms.
- Configure operator identities and printer/laser assignments through your own
  backend. There is no universal administrator password.
- Verify your school's EduSet contract and authorization. Changing its hostname
  does not establish compatibility with a different school system.
- Review absolute paths and generated systemd units. Run services as dedicated
  users and expose only intended gateways; keep database/management ports private.
- Follow the separate AGPL requirements for `backend/latex/` and Overleaf.

## Installation acceptance checks

Use new test accounts to verify signup/recovery, approval, ownership/RLS, cross-site
sign-in, role removal and session revocation. Exercise deployment failures and
backup restoration. Validate mail and device behavior with consenting test users,
and equipment operations under supervision. A successful frontend build alone is
not a production acceptance test. Keep a tested off-host backup before live data
is introduced.
