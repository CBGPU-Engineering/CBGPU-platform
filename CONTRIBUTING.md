# Contributing to CBGPU

Welcome! Start with the [local demo](docs/DEVELOPMENT.md). You do not need a
school account, GPU, production database or server secrets to contribute.

## Workflow

1. Check existing issues. Discuss large changes before implementing them.
2. Fork the repository and create a branch from `main`.
3. Make a focused change. Keep deployment secrets and personal data out of Git.
4. Run the relevant checks below and describe the result in your pull request.
5. Explain the user-visible change, reproduction steps and any setup changes.
   Include screenshots for UI changes, using synthetic accounts only.

Write project documentation, issues and PR summaries in English. Existing Korean
product UI is intentional; preserve it unless the issue requests localization.
Keep existing copyright and license notices. Original contributions use Apache-2.0
unless they belong to a separately licensed component. `backend/latex/` is
AGPL-3.0; do not copy its implementation into Apache-only components.

## Checks

```bash
cd FrontEnd/cbgpu
npm ci
npm test
npm run build:demo
```

At the repository root:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s backend/latex -p test_zip_import.py
```

For native navigation/login changes:

```bash
cd FrontEnd/cbgpu_app
flutter pub get
flutter test test/app_navigation_test.dart test/eduset_login_policy_test.dart
```

CI also runs a browser smoke test against the local demo. Production integration
scripts under `backend/scripts/verify-*` are **not** prerequisites for a normal PR.
Some touch local accounts, Docker or equipment and must be run only by maintainers
in a suitable environment. Never test with real school submissions or send mail
or push notifications to users as part of a PR check.

## Useful first contributions

Documentation corrections, accessibility fixes, small UI bugs, missing fixture
coverage and translation improvements are good starting points. Use the issue
forms; maintainers apply `good first issue` where the task is scoped for newcomers.

## Reviews and support

The project is maintained by a small school team. Reviews are best effort; there
is no response-time guarantee. Use GitHub issues for reproducible bugs and feature
requests. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).
Participation follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
