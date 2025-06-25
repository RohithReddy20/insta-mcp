#!/bin/bash

# Instagram Auth HTTPS Server Startup Script

echo "🚀 Starting Instagram Auth HTTPS Server..."
echo ""

# Check if environment variables are set
if [ -z "$INSTAGRAM_APP_ID" ]; then
    echo "⚠️  INSTAGRAM_APP_ID environment variable not set!"
    echo "Please set it with: export INSTAGRAM_APP_ID=your_app_id"
    echo ""
fi

if [ -z "$INSTAGRAM_APP_SECRET" ]; then
    echo "⚠️  INSTAGRAM_APP_SECRET environment variable not set!"
    echo "Please set it with: export INSTAGRAM_APP_SECRET=your_app_secret"
    echo ""
fi

# Check if SSL certificates exist
if [ ! -f "server.key" ] || [ ! -f "server.cert" ]; then
    echo "🔒 SSL certificates not found. Generating them..."
    npm run generate-certs
    echo ""
fi

echo "📋 Make sure your Instagram app has this redirect URI configured:"
echo "   https://localhost:6001/auth/callback/instagram-standalone"
echo ""

# Start the server
npm start 