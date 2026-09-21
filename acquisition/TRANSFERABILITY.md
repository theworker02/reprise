# Transferability

The project has no mandatory hosted control plane. Core reasoning, the demo, test suite, static site, and checkpoint store run locally. Transfer requires repository administration, package registry ownership if publishing begins, GitHub Actions/GitHub Pages access, any domain configuration, and provider credentials stored outside the repository.

No secrets are embedded in the codebase. A buyer should rotate all provider tokens during transfer and establish its own release-signing and vulnerability-disclosure channels.
