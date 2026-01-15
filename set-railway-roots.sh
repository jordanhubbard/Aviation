#!/bin/bash
# Set root directories for all Railway services

cd /Users/jkh/Src/Aviation

echo "🔧 Setting Root Directories for Railway Services"
echo "================================================="
echo ""

# Note: Railway CLI doesn't have a direct command to set root directory
# This needs to be done via the dashboard or by setting the environment variable

services=(
    "aviation-missions-app:apps/aviation-missions-app"
    "aviation-accident-tracker:apps/aviation-accident-tracker"
    "flight-tracker:apps/flight-tracker"
    "flightplanner:apps/flightplanner"
    "flightschool:apps/flightschool"
    "foreflight-dashboard:apps/foreflight-dashboard"
    "weather-briefing:apps/weather-briefing"
)

for service_config in "${services[@]}"; do
    IFS=':' read -r service_name root_dir <<< "$service_config"
    
    echo "Setting root directory for $service_name..."
    echo "  Root: $root_dir"
    
    # Try to set via environment variable (Railway may support this)
    railway variables set RAILWAY_ROOT_DIRECTORY="$root_dir" --service "$service_name" 2>/dev/null || \
        echo "  ⚠️  Could not set via CLI - please set manually in dashboard"
    
    echo ""
done

echo "================================================="
echo ""
echo "⚠️  IMPORTANT: Railway CLI may not support setting root directories"
echo ""
echo "Please verify in Railway Dashboard that each service has:"
echo "  Settings → Source → Root Directory set correctly"
echo ""
echo "Dashboard: https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd"
echo ""
echo "Expected settings:"
for service_config in "${services[@]}"; do
    IFS=':' read -r service_name root_dir <<< "$service_config"
    echo "  $service_name → $root_dir"
done
