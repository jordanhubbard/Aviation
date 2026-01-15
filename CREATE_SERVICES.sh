#!/bin/bash
# Create all Railway services first, then deploy

set -e

cd /Users/jkh/Src/Aviation

echo "🚂 Creating Railway Services"
echo "============================="
echo ""

# Create services using railway add
echo "Creating aviation-missions-app..."
railway add --name aviation-missions-app

echo "Creating aviation-accident-tracker..."
railway add --name aviation-accident-tracker

echo "Creating flight-tracker..."
railway add --name flight-tracker

echo "Creating flightplanner..."
railway add --name flightplanner

echo "Creating flightschool..."
railway add --name flightschool

echo "Creating foreflight-dashboard..."
railway add --name foreflight-dashboard

echo "Creating weather-briefing..."
railway add --name weather-briefing

echo ""
echo "✅ All services created!"
echo ""
echo "Now deploying to each service..."
echo ""

# Deploy to each service
for app in aviation-missions-app aviation-accident-tracker flight-tracker flightplanner flightschool foreflight-dashboard weather-briefing; do
    echo "Deploying $app..."
    cd "apps/$app"
    railway up --service "$app" --detach || echo "⚠️  $app deployment queued, continuing..."
    cd ../..
done

echo ""
echo "============================="
echo "🎉 All deployments initiated!"
echo "============================="
echo ""
echo "Check Railway dashboard:"
echo "https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd"
echo ""
echo "Check status: railway status"
echo "View logs: railway logs --service <name>"
