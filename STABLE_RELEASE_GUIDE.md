# Stable Release Publishing Guide

## Overview

This repository now has two separate GitHub Actions workflows for publishing packages to npm:

1. **`beta-release.yml`** - Automatically publishes beta/pre-release versions when pushing to the `develop` branch
2. **`publish-stable-only.yml`** - Only publishes stable versions when creating release tags

## Key Changes in the Stable-Only Workflow

### 1. Tag Pattern Matching
The workflow only triggers on stable version tags:
```yaml
tags:
  - "v[0-9]+.[0-9]+.[0-9]+"  # Matches v1.0.0, v2.1.3, etc.
  - "!v*-*"                   # Excludes v1.0.0-beta, v1.0.0-alpha, etc.
```

### 2. Version Validation
Multiple validation checks ensure only stable versions are published:

- **Tag validation**: Checks if the tag follows stable semantic versioning (X.Y.Z)
- **Package.json validation**: Verifies the version in package.json doesn't contain pre-release identifiers
- **Pre-publish validation**: Double-checks before npm publish command

### 3. Prevented Pre-release Identifiers
The workflow will reject versions containing:
- `beta`
- `alpha`
- `rc` (release candidate)
- `pre`
- `preview`
- `dev`
- `canary`

## How to Use

### Publishing a Stable Release

1. **Update the version in package.json** (must be in X.Y.Z format):
   ```bash
   cd packages/pp-dev
   # Update version to stable format (e.g., 0.11.0, not 0.11.0-beta.4)
   npm version 0.11.0 --no-git-tag-version
   ```

2. **Commit the version change**:
   ```bash
   git add .
   git commit -m "chore: release version 0.11.0"
   git push origin main
   ```

3. **Create and push a stable version tag**:
   ```bash
   git tag v0.11.0
   git push origin v0.11.0
   ```

4. **The workflow will automatically**:
   - Validate that the tag is a stable version
   - Check that package.json contains a stable version
   - Build the package
   - Publish to npm with the `latest` tag
   - Create a GitHub release

### Publishing Beta/Pre-release Versions

Beta versions are handled separately:

1. Work on the `develop` branch
2. Versions with `-beta.X` suffix will be published automatically when pushing to `develop`
3. These will be published to npm with the `beta` tag, not `latest`

### Manual Trigger (Emergency Use)

The workflow can be triggered manually from GitHub Actions UI with options:
- **Package**: Specify which package to publish
- **Skip version check**: Override version validation (use with extreme caution!)

## Workflow Behavior Examples

| Tag/Version | Will Publish? | Reason |
|------------|---------------|---------|
| `v1.0.0` | ✅ Yes | Stable semantic version |
| `v2.5.10` | ✅ Yes | Stable semantic version |
| `v1.0.0-beta.1` | ❌ No | Contains beta identifier |
| `v1.0.0-alpha` | ❌ No | Contains alpha identifier |
| `v1.0.0-rc.1` | ❌ No | Contains rc identifier |
| `1.0.0` | ❌ No | Missing 'v' prefix |
| `v1.0` | ❌ No | Not complete semantic version |

## Migration from Current Workflow

To replace the current `publish.yml` with the stable-only version:

1. **Backup current workflow**:
   ```bash
   cp .github/workflows/publish.yml .github/workflows/publish.yml.backup
   ```

2. **Replace with stable-only workflow**:
   ```bash
   cp .github/workflows/publish-stable-only.yml .github/workflows/publish.yml
   ```

3. **Test with a dry run** (if needed):
   - Create a test tag on a feature branch
   - Monitor the workflow execution
   - Verify it correctly identifies and validates versions

## Troubleshooting

### Workflow not triggering
- Ensure tag follows pattern: `v[0-9]+.[0-9]+.[0-9]+`
- Check repository settings for workflow permissions

### Version validation fails
- Verify package.json version is in X.Y.Z format
- Remove any pre-release identifiers from version string

### npm publish fails
- Ensure `npm_token` secret is configured in repository settings
- Verify package name is not already taken on npm registry

## Benefits of This Approach

1. **Prevents accidental beta publications** to the `latest` npm tag
2. **Clear separation** between stable and pre-release workflows
3. **Multiple validation layers** ensure only intended versions are published
4. **Automatic GitHub release creation** for stable versions
5. **Maintains npm tag integrity** (`latest` for stable, `beta` for pre-releases)
