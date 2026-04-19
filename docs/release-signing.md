# Release Signing Setup

This repo now supports two release modes through GitHub Actions:

- unsigned builds when signing secrets are absent
- signed macOS and Windows builds when the relevant secrets are present

Workflow file:

- `.github/workflows/release.yml`

Manual trigger:

- GitHub Actions -> `Build Desktop Releases` -> `Run workflow`

Tagged release trigger:

- push a tag like `v2.0.1`

## Required Secrets

These secrets are optional. If they are not set, the workflow still builds artifacts, but they will be unsigned.

### macOS signing and notarization

The current workflow expects these secrets:

- `APPLE_SIGNING_CERTIFICATE_P12`
- `APPLE_SIGNING_CERTIFICATE_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

Expected values:

- `APPLE_SIGNING_CERTIFICATE_P12`: base64-encoded `.p12` export of your `Developer ID Application` certificate
- `APPLE_SIGNING_CERTIFICATE_PASSWORD`: password used when exporting that `.p12`
- `APPLE_API_KEY`: contents of the App Store Connect API key `.p8`
- `APPLE_API_KEY_ID`: key ID from App Store Connect
- `APPLE_API_ISSUER`: issuer ID from App Store Connect

Notes:

- Electron Builder reads the certificate from `CSC_LINK` and the password from `CSC_KEY_PASSWORD`.
- The workflow maps the GitHub secrets above into those env vars automatically.
- Notarization is attempted only when the Apple API key secrets are present.

### Windows signing

The current workflow expects these secrets:

- `WINDOWS_SIGNING_CERTIFICATE_PFX`
- `WINDOWS_SIGNING_CERTIFICATE_PASSWORD`

Expected values:

- `WINDOWS_SIGNING_CERTIFICATE_PFX`: base64-encoded exported `.pfx` code-signing certificate
- `WINDOWS_SIGNING_CERTIFICATE_PASSWORD`: password for that certificate

Notes:

- The workflow maps these into `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.
- Standard exported code-signing certificates work in CI.
- EV certificates usually do not, because they are commonly bound to hardware tokens.

## Creating the macOS certificate secret

1. Export `Developer ID Application` from Keychain as `.p12`.
2. Base64-encode it:

```bash
base64 -i developer-id-application.p12 | pbcopy
```

3. Paste the copied value into `APPLE_SIGNING_CERTIFICATE_P12`.

## Creating the Windows certificate secret

1. Export the Windows code-signing certificate as `.pfx`.
2. Base64-encode it:

```bash
base64 -i windows-signing-cert.pfx | pbcopy
```

3. Paste the copied value into `WINDOWS_SIGNING_CERTIFICATE_PFX`.

## Current Artifact Targets

- macOS: `.dmg`
- Windows: `.exe` via NSIS
- Linux: `.AppImage`

The workflow also uploads generated update metadata files such as `.blockmap` and `latest*.yml`.
