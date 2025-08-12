# Release Workflow Documentation

## Overview

This document describes the release workflows for the pp-dev-js monorepo, including both beta releases and production releases.

## Workflow Types

### 1. Beta Release Workflow (`.github/workflows/beta-release.yml`)

**Trigger:** Push to `develop` branch

**Purpose:** Creates beta releases for packages that have changes

**Execution Order:**
1. **`pp-dev`** - Released first (core package)
2. **`create-pp-dev`** - Released second (depends on pp-dev)

**Key Features:**
- **Dependency-based execution** - `create-pp-dev` waits for `pp-dev` to complete
- **Automatic package detection** - Only packages with changes are processed
- **Tag verification** - Ensures dependencies exist before proceeding
- **Commit comments** - Provides feedback on successful releases

### 2. Production Release Workflow (`.github/workflows/publish.yml`)

**Trigger:** Push of version tags (`v*` or `*@*`)

**Purpose:** Publishes packages to npm registry

**Execution Order:**
1. **`pp-dev`** - Published first (core package)
2. **`create-pp-dev`** - Published second (depends on pp-dev)

**Key Features:**
- **Dependency-based execution** - `create-pp-dev` waits for `pp-dev` to complete
- **Tag-based triggering** - Automatically detects which package to publish
- **Publication verification** - Confirms packages are available on npm
- **Environment protection** - Uses Release environment for security

## Problem Solved

### Previous Issue: "Behind Remote" Error

The original workflow used a matrix strategy that could run packages simultaneously, causing:

```
The local branch develop is behind the remote one, therefore a new version won't be published.
```

**Root Cause:** When `create-pp-dev` created and pushed tags, `pp-dev` workflow (running in parallel) didn't have those tags, making it appear "behind" the remote.

### Solution: Explicit Job Dependencies

**New Approach:**
- **Separate jobs** for each package instead of matrix
- **Explicit dependencies** using `needs:` keyword
- **Sequential execution** - `pp-dev` always runs first
- **Tag verification** - Ensures dependencies exist before proceeding

## Workflow Structure

### Beta Release Flow

```
detect-packages → beta-release-pp-dev → beta-release-create-pp-dev
```

### Production Release Flow

```
detect-packages → publish-pp-dev → publish-create-pp-dev
```

## Benefits

✅ **No more race conditions** - Clear execution order  
✅ **Dependency safety** - `create-pp-dev` always has latest `pp-dev`  
✅ **Reliable releases** - Consistent, predictable behavior  
✅ **Easy debugging** - Clear job separation and dependencies  
✅ **Scalable** - Easy to add more packages with dependencies  

## Configuration

### Environment Variables Required

- `GITHUB_TOKEN` - GitHub API access
- `NPM_TOKEN` - npm registry authentication
- `NODE_AUTH_TOKEN` - npm authentication (alias for NPM_TOKEN)

### Permissions

- `contents: write` - Create tags and releases
- `id-token: write` - GitHub App authentication
- `pull-requests: write` - Create commit comments

## Adding New Packages

To add a new package to the release workflow:

1. **Add new job** in the workflow file
2. **Set dependencies** using `needs:` array
3. **Configure working directory** for the package
4. **Add dependency verification** if needed

### Example

```yaml
publish-new-package:
  needs: [detect-packages, publish-pp-dev]
  if: ${{ contains(fromJSON(needs.detect-packages.outputs.packages), 'new-package') }}
  # ... rest of configuration
```

## Troubleshooting

### Common Issues

1. **"pp-dev tag not found"** - Ensure `pp-dev` job completed successfully
2. **Build failures** - Check package build configuration
3. **Permission errors** - Verify workflow permissions and secrets

### Debug Steps

1. Check workflow run logs for specific job failures
2. Verify package detection logic is working
3. Confirm all required secrets are configured
4. Check package.json and build scripts

## Best Practices

1. **Always test** workflow changes on feature branches first
2. **Monitor releases** to ensure proper execution order
3. **Keep dependencies** minimal and well-defined
4. **Use semantic versioning** for consistent releases
5. **Document changes** when modifying workflow logic
