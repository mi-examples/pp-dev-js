# Docker Testing Environment

This Dockerfile allows running tests for all packages of the pp-dev-js project in an isolated environment.

## Test Structure

- `test-commonjs` - Tests for CommonJS modules
- `test-nextjs` - Tests for Next.js applications (ESM)
- `test-nextjs-cjs` - Tests for Next.js applications (CommonJS)

## Usage

### 1. Building Docker Image

```bash
# From project root directory
docker build -f tests/Dockerfile -t pp-dev-tests .
```

### 2. Running Tests

#### Run All Tests
```bash
docker run pp-dev-tests
# or
docker run pp-dev-tests all
```

#### Run Specific Tests
```bash
# Only CommonJS tests
docker run pp-dev-tests commonjs

# Only Next.js tests
docker run pp-dev-tests nextjs

# Only Next.js CJS tests
docker run pp-dev-tests nextjs-cjs
```

### 3. Using Docker Compose

#### Run All Tests
```bash
cd tests
docker-compose up test-all
```

#### Run Specific Tests
```bash
cd tests
docker-compose up test-commonjs
docker-compose up test-nextjs
docker-compose up test-nextjs-cjs
```

#### Run Dev Servers
```bash
cd tests
# CommonJS dev server (port 3000)
docker-compose up dev-commonjs

# Next.js dev server (port 3001)
docker-compose up dev-nextjs

# Next.js CJS dev server (port 3002)
docker-compose up dev-nextjs-cjs
```

#### Interactive Mode for Debugging
```bash
cd tests
docker-compose up test-interactive
```

### 4. Using Makefile (Recommended)

For convenience, a Makefile with ready-to-use commands has been created:

```bash
cd tests

# Show all available commands
make help

# Build Docker image
make build

# Run all tests
make test

# Run specific tests
make test-commonjs
make test-nextjs
make test-nextjs-cjs

# Run dev servers
make dev-commonjs    # http://localhost:3000
make dev-nextjs      # http://localhost:3001
make dev-nextjs-cjs  # http://localhost:3002

# Clean Docker resources
make clean
```

### 5. Saving Test Results

Test results are saved in the `test-results` folder (created automatically).

## Available Commands

### Testing
- `commonjs` - Run CommonJS module tests
- `nextjs` - Run Next.js tests (ESM)
- `nextjs-cjs` - Run Next.js tests (CommonJS)
- `all` - Run all tests (default)

### Development
- `dev-commonjs` - Start CommonJS dev server (port 3000)
- `dev-nextjs` - Start Next.js dev server (port 3001)
- `dev-nextjs-cjs` - Start Next.js CJS dev server (port 3002)

## Docker Image Structure

```
/app/
├── packages/
│   ├── pp-dev/          # Built pp-dev package
│   └── create-pp-dev/   # Built create-pp-dev package
└── tests/
    ├── test-commonjs/   # CommonJS tests
    ├── test-nextjs/     # Next.js ESM tests
    └── test-nextjs-cjs/ # Next.js CJS tests
```

## Configuration

Dockerfile automatically:
1. Installs Node.js 20
2. Copies and builds all packages
3. Installs dependencies for test folders
4. Creates script for running tests

## Requirements

- Docker
- Docker Compose (optional)
- Node.js 20+ (for local development)
