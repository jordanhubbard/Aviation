#!/bin/sh
set -e

# Create necessary directories
mkdir -p data logs backend/data

# Check if we're running tests
if [ "$1" = "npm" ] && [ "$2" = "test" ]; then
    echo "Running tests..."
    cd /app/backend
    exec "$@"
else
    echo "🛩️  Starting Aviation Accident Tracker"
    cd /app

    report_child_exit() {
        PROC_NAME="$1"
        EXIT_CODE="$2"

        if [ "$EXIT_CODE" -eq 0 ]; then
            return
        fi

        echo "⚠️  ${PROC_NAME} exited with code ${EXIT_CODE}" >&2
    }

    # Start backend API (Express)
    BACKEND_PORT=${PORT:-${BACKEND_PORT:-3002}}
    echo "Starting Express API on port ${BACKEND_PORT}..."
    cd /app/backend
    
    if [ "${NODE_ENV}" = "development" ]; then
        # Development mode with auto-reload
        npm run dev &
    else
        # Production mode
        npm start &
    fi
    
    BACKEND_PID=$!
    cd /app
    
    # In development, start frontend dev server
    if [ "${NODE_ENV}" = "development" ] && [ -d "/app/frontend" ]; then
        FRONTEND_PORT=${FRONTEND_PORT:-5173}
        echo "Starting Vite dev server on port ${FRONTEND_PORT}..."
        cd /app/frontend
        npm install --silent 2>/dev/null || true
        npm run dev &
        FRONTEND_PID=$!
        cd /app
    else
        echo "Production mode: Backend serves built frontend static files"
        FRONTEND_PID=""
    fi
    
    # Handle shutdown signals
    if [ -n "$FRONTEND_PID" ]; then
        trap 'kill $BACKEND_PID $FRONTEND_PID; exit 0' TERM INT
    else
        trap 'kill $BACKEND_PID; exit 0' TERM INT
    fi
    
    # Keep the script running
    echo "✅ Services started successfully!"
    if [ -n "$FRONTEND_PID" ]; then
        echo "🎯 Frontend UI: http://localhost:${FRONTEND_PORT:-5173}"
        echo "🔧 Backend API: http://localhost:${BACKEND_PORT:-3002}"
        echo "📚 API Docs: http://localhost:${BACKEND_PORT:-3002}/api-docs"
        echo "🔍 GraphQL: http://localhost:${BACKEND_PORT:-3002}/graphql"
        set +e
        wait $BACKEND_PID
        BACKEND_EXIT=$?
        wait $FRONTEND_PID
        FRONTEND_EXIT=$?
        set -e

        if [ "$BACKEND_EXIT" -ne 0 ]; then
            AVIATION_CHILD_NAME=backend AVIATION_CHILD_EXIT_CODE=$BACKEND_EXIT report_child_exit backend $BACKEND_EXIT
        fi
        if [ "$FRONTEND_EXIT" -ne 0 ]; then
            AVIATION_CHILD_NAME=frontend AVIATION_CHILD_EXIT_CODE=$FRONTEND_EXIT report_child_exit frontend $FRONTEND_EXIT
        fi

        if [ "$BACKEND_EXIT" -ne 0 ]; then
            exit $BACKEND_EXIT
        fi
        exit $FRONTEND_EXIT
    else
        echo "🌐 Backend API: http://localhost:${BACKEND_PORT:-3002}"
        echo "📚 API Docs: http://localhost:${BACKEND_PORT:-3002}/api-docs"
        echo "🔍 GraphQL: http://localhost:${BACKEND_PORT:-3002}/graphql"
        set +e
        wait $BACKEND_PID
        BACKEND_EXIT=$?
        set -e

        if [ "$BACKEND_EXIT" -ne 0 ]; then
            AVIATION_CHILD_NAME=backend AVIATION_CHILD_EXIT_CODE=$BACKEND_EXIT report_child_exit backend $BACKEND_EXIT
        fi
        exit $BACKEND_EXIT
    fi
fi
