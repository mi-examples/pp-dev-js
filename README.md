# Portal Page Dev

> MetricInsights Portal Page development framework and build tools

## Overview

This monorepo contains tools and packages for developing MetricInsights Portal Pages:

- `pp-dev`: Core development framework and build tool for Portal Pages
- `create-pp-dev`: CLI tool for scaffolding new Portal Page projects

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@metricinsights/pp-dev](packages/pp-dev) | Core development framework and build tool for Portal Pages | [![npm version](https://img.shields.io/npm/v/@metricinsights/pp-dev)](https://www.npmjs.com/package/@metricinsights/pp-dev) |
| [@metricinsights/create-pp-dev](packages/create-pp-dev) | CLI tool for scaffolding new Portal Page projects | [![npm version](https://img.shields.io/npm/v/@metricinsights/create-pp-dev)](https://www.npmjs.com/package/@metricinsights/create-pp-dev) |

## 🚀 Release Workflow

This repository uses **semantic-release** for automated versioning and releases with a **PR-based workflow**. Direct pushes to the main branch are not allowed - all releases go through Pull Requests.

### How It Works

1. **Create feature branch** from `main` or `develop`
2. **Make changes** following [conventional commit format](https://www.conventionalcommits.org/)
3. **Create Pull Request** and get it reviewed
4. **Merge to main** → **Automatic release!** 🎉

### Branch Strategy

- **`main`** → Production releases (stable versions)
- **`develop`** → Beta releases (pre-release versions)
- **Feature branches** → Development work

### Commit Message Examples

```bash
# New feature (minor version bump)
git commit -m "feat: add new authentication system"

# Bug fix (patch version bump)
git commit -m "fix: resolve memory leak in data processing"

# Breaking change (major version bump)
git commit -m "feat!: change API response format

BREAKING CHANGE: The API now returns data in a different structure"
```

## 📚 Documentation

- [📖 Complete Release Workflow Guide](RELEASE_WORKFLOW.md) - Detailed user guide
- [⚙️ Semantic Release Setup](SEMANTIC_RELEASE_SETUP.md) - Technical setup details
- [pp-dev documentation](packages/pp-dev/README.md) - Core framework docs
- [create-pp-dev documentation](packages/create-pp-dev/README.md) - CLI tool docs
- [Contributing Guidelines](CONTRIBUTING.md) - How to contribute

## Getting Started

### Creating a New Portal Page Project

```bash
# Using npm
npm create @metricinsights/pp-dev@latest

# Using yarn
yarn create @metricinsights/pp-dev

# Using pnpm
pnpm create @metricinsights/pp-dev
```

### Development Setup

```bash
# Clone and install
git clone https://github.com/mi-examples/pp-dev-js.git
cd pp-dev-js
npm install

# Build all packages
npm run build

# Available scripts
npm run release        # Run semantic-release
npm run release:beta  # Run beta release on develop branch
```

**Note:** This project includes a `.cursorrules` file with comprehensive commit message guidelines and development best practices for Cursor AI users.

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch** from `main` or `develop`
3. **Make your changes** with conventional commits
4. **Push to your fork** and create a Pull Request
5. **Get it reviewed** and merge when approved
6. **Automatic release** happens on merge to main! 🎉

### Guidelines

- Use [conventional commit format](https://www.conventionalcommits.org/)
- Keep commits focused and atomic
- Provide clear PR descriptions
- Ensure tests pass and documentation is updated

## 🔗 Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Release Documentation](https://semantic-release.gitbook.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## 📄 License

ISC License - see [LICENSE](LICENSE) file for details.

---

**Happy Developing! 🚀**

For detailed information about the release process, check the [Release Workflow Guide](RELEASE_WORKFLOW.md) or [Semantic Release Setup](SEMANTIC_RELEASE_SETUP.md) documentation.
