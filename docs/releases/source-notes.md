Source release of the CBGPU school platform. See CHANGELOG.md for changes,
README.md for features and verification scope, and docs/DEVELOPMENT.md for the
credential-free local demo. Production installation requires separate backend,
DNS, secrets and equipment setup.

The source archive includes license notices. `web-sbom.cdx.json` inventories the
installed production npm dependencies of the web component; it is not a complete
inventory of host software, Docker images, Dart or Python packages. Validate
asset integrity with `sha256sum -c SHA256SUMS`.

Original code is Apache-2.0 except separately licensed components, including the
AGPL LaTeX integration. Android binaries use separate `android-vX.Y.Z` releases.
