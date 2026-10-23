#!/bin/bash
# Test Railway Deployment Script
# This script helps you test the Railway deployment setup

set -e

echo "🚂 Railway Deployment Test Script"
echo "=================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found"
    echo ""
    echo "Install it with:"
    echo "  npm install -g @railway/cli"
    echo ""
    exit 1
fi

echo "✅ Railway CLI is installed"
railway --version
echo ""

# Check if logged in
echo "🔐 Checking Railway login status..."
if railway whoami &> /dev/null; then
    echo "✅ Logged in to Railway as: $(railway whoami)"
else
    echo "❌ Not logged in to Railway"
    echo ""
    echo "Login with:"
    echo "  railway login"
    echo ""
    exit 1
fi
echo ""

# Check if project is linked
echo "🔗 Checking project link..."
if railway status &> /dev/null; then
    echo "✅ Project is linked to Railway"
    railway status
else
    echo "⚠️  Project not linked to Railway"
    echo ""
    echo "Link your project with:"
    echo "  railway link"
    echo ""
    echo "Or initialize a new project:"
    echo "  railway init"
    echo ""
    exit 1
fi
echo ""

# Check for railway.toml
echo "📋 Checking configuration..."
if [ -f "railway.toml" ]; then
    echo "✅ Found railway.toml"
    echo "Configuration:"
    cat railway.toml
else
    echo "⚠️  No railway.toml found (Railway will use defaults)"
fi
echo ""

# Check Dockerfile
if [ -f "Dockerfile" ]; then
    echo "✅ Found Dockerfile"
else
    echo "❌ No Dockerfile found"
    exit 1
fi
echo ""

# Test Docker build locally
echo "🐳 Testing Docker build..."
if docker build -t aviation-missions-test:local . > /dev/null 2>&1; then
    echo "✅ Docker build successful"
else
    echo "❌ Docker build failed"
    echo "Run 'make build' to see detailed errors"
    exit 1
fi
echo ""

# Show current environment variables
echo "🔧 Current Railway environment variables:"
railway variables
echo ""

# Test deployment (dry run)
echo "🧪 Testing deployment readiness..."
echo ""
echo "Everything looks good! 🎉"
echo ""
echo "To deploy:"
echo "  1. Manual: railway up"
echo "  2. Automatic: git push origin main"
echo ""
echo "To view logs:"
echo "  railway logs --follow"
echo ""
echo "To open your app:"
echo "  railway open"
echo ""

# Show GitHub Actions status
if command -v gh &> /dev/null; then
    echo "📊 Recent GitHub Actions deployments:"
    gh run list --workflow=deploy-railway.yml --limit 5 2>/dev/null || echo "  (Install 'gh' CLI to see deployment history)"
    echo ""
fi

echo "✅ Railway deployment test complete!"

