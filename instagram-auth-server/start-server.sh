#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Instagram Auth HTTPS Server Startup Script

echo "🚀 Starting Instagram Auth HTTPS Server..."
echo ""

# --- Debugging Start ---
echo "--- Debugging Info ---"
echo "Script path: $0"
echo "Initial directory: $(pwd)"
# --- Debugging End ---

# Change to the script's directory
cd "$(dirname "$0")"

# --- Debugging Start ---
echo "Current directory after cd: $(pwd)"
echo "Listing files in current directory:"
ls -la
echo "--- End Debugging Info ---"
echo ""
# --- Debugging End ---

# Check if .env file exists. If not, create it and exit.
if [ ! -f .env ]; then
  echo "⚠️ .env file not found."
  echo "Creating a new .env file with placeholder values..."
  # Create .env file with placeholder content
  cat > .env <<- EOL
# Add your Instagram App credentials here
INSTAGRAM_APP_ID=YOUR_APP_ID_HERE
INSTAGRAM_APP_SECRET=YOUR_APP_SECRET_HERE
EOL
  echo "✅ Successfully created .env file in the 'instagram-auth-server' directory."
  echo "🛑 Please edit the .env file with your actual credentials and run this script again."
  exit 1
fi

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Check for required environment variables
if [ -z "$INSTAGRAM_APP_ID" ] || [ "$INSTAGRAM_APP_ID" = "YOUR_APP_ID_HERE" ]; then
  echo "⚠️  INSTAGRAM_APP_ID is not set in your .env file!"
  echo "Please add it to instagram-auth-server/.env"
  exit 1
fi

if [ -z "$INSTAGRAM_APP_SECRET" ] || [ "$INSTAGRAM_APP_SECRET" = "YOUR_APP_SECRET_HERE" ]; then
  echo "⚠️  INSTAGRAM_APP_SECRET is not set in your .env file!"
  echo "Please add it to instagram-auth-server/.env"
  exit 1
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

# Start the server using npm start
npm start 