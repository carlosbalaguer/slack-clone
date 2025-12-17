#!/bin/sh
set -e

echo "🔄 Running database migrations..."
node node_modules/.bin/node-pg-migrate up --envPath .env.production || {
  echo "⚠️  Migrations failed, but continuing..."
}

echo "🚀 Starting application..."
exec dumb-init node dist/src/index.js