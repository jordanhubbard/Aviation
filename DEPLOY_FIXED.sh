#!/bin/bash
# Deploy all apps to Railway - Fixed version
# Creates services first, then deploys

set -e

cd /Users/jkh/Src/Aviation

echo "🚂 Deploying Aviation Apps to Railway"
echo "======================================="
echo ""

# Array of apps
apps=(
    "aviation-missions-app"
    "aviation-accident-tracker"
    "flight-tracker"
    "flightplanner"
    "flightschool"
    "foreflight-dashboard"
    "weather-briefing"
)

# Deploy each app
for app in "${apps[@]}"; do
    echo ""
    echo "========================================="
    echo "🚀 Deploying: $app"
    echo "========================================="
    
    cd "apps/$app"
    
    # Create service and deploy in one command
    # The -d flag detaches so we don't wait for completion
    railway up --detach --service "$app" || railway up --detach
    
    cd ../..
    
    echo "✅ $app deployment started"
    sleep 2
done

echo ""
echo "======================================="
echo "🎉 All deployments initiated!"
echo "======================================="
echo ""
echo "Check status with: railway status"
echo "View logs with: railway logs --service <service-name>"
echo ""
echo "Dashboard: https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd"
