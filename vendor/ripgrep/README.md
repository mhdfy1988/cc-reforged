# ripgrep vendor

`scripts/prepare-ripgrep-vendor.mjs` prepares the platform-specific ripgrep binary used by CCR when no embedded Bun ripgrep is available.

Only the target platform should be copied for a release package. Each target directory includes the binary, the upstream license, and a small `SOURCE.json` provenance file.
