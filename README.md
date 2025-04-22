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

### Development

For detailed documentation on developing Portal Pages, see the documentation for each package:

- [pp-dev documentation](packages/pp-dev/README.md)
- [create-pp-dev documentation](packages/create-pp-dev/README.md)
