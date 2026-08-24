#!/bin/bash
# 1-Click DigitalOcean Deployment Script

echo "========================================="
echo "🚀 Starting DigitalOcean Deployment..."
echo "========================================="

# Update packages and install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
    sudo systemctl enable --now docker
fi

# Build and start containers
echo "🐳 Starting PostgreSQL, Redis, FastAPI Backend, & Celery Worker..."
docker compose down --remove-orphans || true
docker compose up --build -d

echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================="
echo "🔗 Backend Swagger UI: http://YOUR_DIGITAL_OCEAN_IP:8000/docs"
echo "🔗 Evaluator Microservice UI: http://YOUR_DIGITAL_OCEAN_IP:8000/evaluator/docs"
echo "========================================="
