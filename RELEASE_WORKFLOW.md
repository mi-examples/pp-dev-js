# Release Workflow Guide

This repository uses semantic-release for automated versioning and releases. Since direct pushes to the main branch are not allowed, releases are handled through Pull Requests.

## How It Works

### 1. Development Workflow

1. **Create a feature branch** from `main` or `develop`
2. **Make your changes** following conventional commit format
3. **Push to your branch** and create a Pull Request
4. **Merge the PR** to trigger the release process

### 2. Branch Strategy

- **`main`**: Production releases (stable versions)
- **`develop`**: Beta releases (pre-release versions)
- **Feature branches**: Development work

### 3. Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types that trigger releases:**
- `feat`: New features (minor version bump)
- `fix`: Bug fixes (patch version bump)
- `BREAKING CHANGE`: Breaking changes (major version bump)

**Types that don't trigger releases:**
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat: add new authentication system"
git commit -m "fix: resolve memory leak in data processing"
git commit -m "feat!: change API response format

BREAKING CHANGE: The API now returns data in a different structure"
```

## Release Process

### Automatic Release on PR Merge

When a PR is merged to `main`:
1. The `release-pr.yml` workflow detects changed packages
2. Runs semantic-release for each changed package
3. Creates a new GitHub release with changelog
4. Comments on the PR with release information

### Beta Releases

When changes are pushed to `develop`:
1. The `beta-release.yml` workflow creates beta versions
2. Beta versions are tagged with `beta` channel
3. No npm publishing (only GitHub releases)

### Manual Publishing

To publish to npm, create a tag:
```bash
git tag v1.2.3
git push origin v1.2.3
```

This triggers the `publish.yml` workflow to publish to npm.

## Configuration Files

### `.releaserc.json`

Located in each package directory, configures semantic-release behavior:
- Branch configuration (main + develop)
- Plugin setup (commit analyzer, changelog, git, GitHub)
- Monorepo support

### GitHub Workflows

- **`release-pr.yml`**: Handles releases when PRs are merged to main
- **`beta-release.yml`**: Creates beta releases on develop branch
- **`publish.yml`**: Publishes packages to npm from tags

## Package.json Scripts

Each package has these scripts:
```json
{
  "scripts": {
    "release": "semantic-release",
    "version": "npm version --commit-hooks false --git-tag-version false"
  }
}
```

## Troubleshooting

### Release Not Triggering

1. **Check commit messages**: Ensure they follow conventional commit format
2. **Verify branch**: PR must be merged to `main` or pushed to `develop`
3. **Check workflow logs**: Look for errors in GitHub Actions

### Version Bumping Issues

1. **No changes detected**: Ensure files in the package directory were modified
2. **Wrong version type**: Check commit message type (feat/fix/BREAKING CHANGE)
3. **Monorepo issues**: Verify `semantic-release-monorepo` is properly configured

### GitHub Actions Failures

1. **Permissions**: Ensure workflows have proper permissions
2. **Secrets**: Verify `GITHUB_TOKEN` and `npm_token` are set
3. **Environment**: Check if Release environment exists and is configured

## Best Practices

1. **Always use conventional commits** for meaningful version bumps
2. **Test in develop branch** before merging to main
3. **Review changelog** before releasing
4. **Use semantic versioning** appropriately
5. **Keep PRs focused** on single features/fixes

## Manual Release

If you need to manually trigger a release:

1. Go to GitHub Actions
2. Select the appropriate workflow
3. Click "Run workflow"
4. Choose the package (or leave empty for all)
5. Click "Run workflow"

## Support

For issues with the release process:
1. Check GitHub Actions logs
2. Review semantic-release documentation
3. Verify configuration files
4. Check commit message format
