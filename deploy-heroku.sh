#!/bin/bash
# Heroku deployment script for geoTool

set -e

echo "🚀 Deploying geoTool to Heroku..."

# Check if heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed. Please install it first."
    exit 1
fi

# Check if logged in
if ! heroku auth:whoami &> /dev/null; then
    echo "⚠️  Not logged in to Heroku. Please run: heroku login"
    exit 1
fi

# Create app (will fail if app already exists, that's OK)
echo "📦 Creating Heroku app..."
heroku create geotool-app || echo "App already exists or name taken, continuing..."

# Set buildpacks
echo "🔧 Setting up buildpacks..."
heroku buildpacks:clear -a geotool-app
heroku buildpacks:add https://github.com/jontewks/puppeteer-heroku-buildpack.git -a geotool-app || true
heroku buildpacks:add heroku/nodejs -a geotool-app

# Add PostgreSQL addon
echo "🗄️  Adding PostgreSQL database..."
heroku addons:create heroku-postgresql:mini -a geotool-app || echo "Database might already exist"

# Set environment variables (you'll need to set these manually with your actual values)
echo "⚠️  Remember to set these environment variables:"
echo "   heroku config:set OPENAI_API_KEY=your_key -a geotool-app"
echo "   heroku config:set ANTHROPIC_API_KEY=your_key -a geotool-app"
echo "   heroku config:set DATABASE_URL=\$(heroku config:get DATABASE_URL -a geotool-app)"
echo "   heroku config:set RUN_DEFAULT_BATCH=40 -a geotool-app"
echo "   heroku config:set RUN_SEED=42 -a geotool-app"
echo "   heroku config:set TEMPERATURE=0 -a geotool-app"
echo "   heroku config:set TOP_P=1 -a geotool-app"
echo "   heroku config:set OPENAI_MODEL=gpt-4o-mini -a geotool-app"
echo "   heroku config:set ANTHROPIC_MODEL=claude-3-haiku-20240307 -a geotool-app"

# Run database migrations
echo "🗄️  Running database migrations..."
heroku run "cd packages/db && pnpm prisma migrate deploy" -a geotool-app

# Push to Heroku
echo "📤 Pushing to Heroku..."
git push heroku main

echo "✅ Deployment complete!"
echo "🌐 Your app should be available at: https://geotool-app.herokuapp.com"

