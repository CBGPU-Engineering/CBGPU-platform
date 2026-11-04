# Releases

Platform source tags are `vX.Y.Z`; native Android tags are `android-vX.Y.Z`.
Android's version must match `FrontEnd/cbgpu_app/pubspec.yaml` and its build number
must increase for a new app release. The first source baseline uses `v0.1.0`;
the existing signed app is Android 1.0.7 (build 8).

1. Review CHANGELOG.md and license/dependency changes. Run the CI checks and
   verify the `main` commit's CI result before tagging it.
2. Create and push an annotated tag from that exact commit.
3. The source workflow reruns web checks and creates a source archive, web npm
   CycloneDX SBOM, third-party notices and SHA256SUMS. It publishes through the
   repository's scoped Actions token; no personal token is needed.
4. Review release notes and verify downloaded assets using `sha256sum -c SHA256SUMS`.

```bash
git tag -a v0.1.0 -m 'CBGPU source baseline'
git push origin v0.1.0
```

For signed Android automation configure repository Actions secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD`. Never commit the keystore or passwords. The Android
workflow skips publication if secrets are absent; it does not publish a
fallback debug-signed build. Back up the signing key separately and retain it
for compatibility with existing app installations.

An operator can instead build locally with the same signing key, check version
and signing certificate, then upload the APK and generated checksums with `gh
release create/upload`. The baseline Android 1.0.7 release uses the existing
locally signed binary; no signing key is uploaded to GitHub during setup.

Source archives intentionally omit Android binaries. Old Git history still
contains previously committed APKs; no repository history purge is part of this
change. Server-side `/downloads` files remain managed by operators independently
of the source checkout. Before deploying a clean checkout, install the desired
APK into its ignored download path if retaining that route.
