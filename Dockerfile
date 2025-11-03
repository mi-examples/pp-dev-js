# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json files for dependency caching
COPY package*.json ./
COPY packages/pp-dev/*latest.tgz ./packages/pp-dev/

# Install root project dependencies
RUN npm i

# Return to root directory
WORKDIR /app

# Copy test folders
COPY tests/ ./tests/

# Return to root directory
WORKDIR /app

# Copy and setup script for running tests
COPY run-tests.sh /usr/local/bin/run-tests.sh

# Fix line endings
RUN sed -i 's/\r$//' /usr/local/bin/run-tests.sh

# Make script executable
RUN chmod +x /usr/local/bin/run-tests.sh

# Set entry point
ENTRYPOINT ["/usr/local/bin/run-tests.sh"]

# Default command runs all tests
CMD ["dev-commonjs"]
