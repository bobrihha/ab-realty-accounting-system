#!/usr/bin/env bash
# Quick Deploy Script - One-command production deployment

set -euo pipefail

echo "======================================"
echo "  AB Realty - Quick Deploy Script    "
echo "======================================"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "⚠️  .env.production not found!"
    echo ""
    echo "Creating from template..."
    cp env.production.template .env.production
    
    # Generate NEXTAUTH_SECRET
    SECRET=$(openssl rand -base64 32)
    sed -i.bak "s|YOUR_NEXTAUTH_SECRET_MINIMUM_32_CHARACTERS|$SECRET|g" .env.production
    
    # Generate random postgres password
    PG_PASS=$(openssl rand -base64 16)
    sed -i.bak "s|YOUR_SECURE_PASSWORD_HERE|$PG_PASS|g" .env.production
    sed -i.bak "s|YOUR_SECURE_PASSWORD|$PG_PASS|g" .env.production
    
    rm -f .env.production.bak
    
    echo "✓ Created .env.production with generated secrets"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.production and set:"
    echo "   - NEXTAUTH_URL (your domain)"
    echo ""
    read -p "Press Enter to continue after editing .env.production..."
fi

# Load environment
set -a
source .env.production
set +a

echo "Starting deployment..."
echo ""

# Step 1: Build and start containers
echo "1️⃣  Building Docker containers..."
docker-compose build

echo ""
echo "2️⃣  Starting services..."
docker-compose --env-file .env.production up -d

# Wait for PostgreSQL to be ready
echo ""
echo "3️⃣  Waiting for PostgreSQL to be ready..."
sleep 10

until docker-compose exec -T postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done

echo "   ✓ PostgreSQL is ready"

# Step 2: Initialize database
echo ""
echo "4️⃣  Initializing database..."
docker-compose exec -T app npx prisma db push

if [ "${SEED_ON_DEPLOY:-0}" = "1" ]; then
    echo ""
    echo "5️⃣  Creating owner user..."
    docker-compose exec -T app npm run db:seed
else
    echo ""
    echo "5️⃣  Skipping seed (set SEED_ON_DEPLOY=1 to enable)"
fi

# Step 3: Health check
echo ""
echo "6️⃣  Running health check..."
sleep 5

if curl -s http://localhost:3000/api/health | grep -q "healthy"; then
    echo "   ✓ Application is healthy"
else
    echo "   ⚠️  Health check failed, check logs:"
    echo "      docker-compose logs app"
fi

echo ""
echo "======================================"
echo "  ✅ Deployment Complete!"
echo "======================================"
echo ""
echo "Access your application:"
echo "  • Local: http://localhost:3000"
echo "  • Production: $NEXTAUTH_URL"
echo ""
echo "Default credentials:"
echo "  • Email: owner@agency.local"
echo "  • Password: owner12345"
echo ""
echo "⚠️  IMPORTANT: Change the default password after first login!"
echo ""
echo "Useful commands:"
echo "  • View logs:    docker-compose logs -f"
echo "  • Stop:         docker-compose down"
echo "  • Restart:      docker-compose restart"
echo "  • Backup DB:    bash scripts/backup-db.sh"
echo ""
