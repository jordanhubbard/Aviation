#!/bin/bash
# Deploy all Aviation apps to Railway
# This script requires interactive input and should be run manually

set -e

echo "🚂 Aviation Monorepo - Railway Deployment Script"
echo "=================================================="
echo ""
echo "This script will deploy all 7 aviation applications to Railway."
echo "You'll need to provide input for each service."
echo ""
echo "Project ID: 13aee1ec-6de6-4ae3-9d65-cb5d29d058bd"
echo ""

# Check if logged in
echo "Checking Railway authentication..."
if ! railway whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Railway. Please run: railway login"
    exit 1
fi

echo "✅ Logged in as: $(railway whoami)"
echo ""

# Link to project
echo "📎 Linking to Railway project..."
echo "When prompted, select the 'practical-transformation' project"
railway link
echo ""

# Array of apps to deploy
declare -A APPS=(
    ["aviation-missions-app"]="apps/aviation-missions-app"
    ["aviation-accident-tracker"]="apps/aviation-accident-tracker"
    ["flight-tracker"]="apps/flight-tracker"
    ["flightplanner"]="apps/flightplanner"
    ["flightschool"]="apps/flightschool"
    ["foreflight-dashboard"]="apps/foreflight-dashboard"
    ["weather-briefing"]="apps/weather-briefing"
)

# Deploy each app
for APP_NAME in "${!APPS[@]}"; do
    APP_PATH="${APPS[$APP_NAME]}"
    
    echo "========================================="
    echo "🚀 Deploying: $APP_NAME"
    echo "   Path: $APP_PATH"
    echo "========================================="
    echo ""
    
    # Change to app directory
    cd "$APP_PATH"
    
    # Create railway.toml if it doesn't exist
    if [ ! -f "railway.toml" ]; then
        echo "📝 Creating railway.toml..."
        cat > railway.toml <<EOF
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = ""
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF
        echo "✅ railway.toml created"
    fi
    
    echo ""
    echo "📦 Deploying $APP_NAME to Railway..."
    echo "   This may take a few minutes..."
    railway up
    
    echo ""
    echo "✅ $APP_NAME deployed!"
    echo ""
    
    # Go back to root
    cd /Users/jkh/Src/Aviation
    
    echo "Waiting 5 seconds before next deployment..."
    sleep 5
done

echo ""
echo "========================================="
echo "🎉 All applications deployed successfully!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Check Railway dashboard: https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd"
echo "2. Verify all services are running"
echo "3. Set environment variables for each service"
echo "4. Check logs for any issues"
echo ""
echo "To set environment variables:"
echo "  railway variables set KEY=value --service <service-name>"
echo ""
echo "To view logs:"
echo "  railway logs --service <service-name>"
echo ""
