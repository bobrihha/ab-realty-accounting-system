# 🚀 Production Deployment Guide

Complete guide for deploying the AB Realty Accounting System to production.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Deployment](#manual-deployment)
4. [PostgreSQL Migration](#postgresql-migration)
5. [SSL/HTTPS Setup](#ssl-https-setup)
6. [Environment Configuration](#environment-configuration)
7. [Backup & Restore](#backup--restore)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: 20GB+ available
- **CPU**: 2+ cores recommended

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Git
- (Optional) Make

### Domain & DNS

- Domain name pointed to your server IP
- Ports 80 and 443 open in firewall

---

## Quick Start (Docker)

### 1. Clone Repository

```bash
git clone https://github.com/bobrihha/ab-realty-accounting-system.git
cd ab-realty-accounting-system
```

### 2. Configure Environment

```bash
# Copy environment template
cp env.production.template .env.production

# Edit with your values
nano .env.production
```

**Required values:**
- `POSTGRES_PASSWORD` - Strong database password
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` - Your domain (e.g., `https://yourdomain.com`)

### 3. Start Services

```bash
# Start all services
docker-compose --env-file .env.production up -d

# View logs
docker-compose logs -f app
```

### 4. Initialize Database

```bash
# Wait for PostgreSQL to be ready (check logs)
docker-compose logs postgres

# Run migrations inside container
docker-compose exec app npx prisma db push

# Create owner user
docker-compose exec app npm run db:seed
```

### 5. Access Application

**Without SSL (HTTP):**
- Comment out nginx HTTPS block in `docker-compose.yml`
- Access: `http://your-server-ip`

**With SSL:** See [SSL/HTTPS Setup](#ssl-https-setup)

---

## Manual Deployment

For deployment without Docker:

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PostgreSQL

```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE realty_agency;
CREATE USER realtyuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE realty_agency TO realtyuser;
\q
```

### 3. Build Application

```bash
# Install dependencies
npm ci --production

# Configure environment
cp env.production.template .env.production
nano .env.production

# Build application
npm run build
```

### 4. Run with PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "realty-app" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

---

## PostgreSQL Migration

Migrate from SQLite to PostgreSQL:

### Automated Migration

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://realtyuser:password@localhost:5432/realty_agency"

# Run migration script
bash scripts/migrate-to-postgres.sh
```

### Manual Migration

1. **Update Prisma Schema:**
   ```bash
   # Change datasource in prisma/schema.prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Generate Client:**
   ```bash
   npx prisma generate
   ```

3. **Push Schema:**
   ```bash
   npx prisma db push
   ```

4. **Seed Database:**
   ```bash
   npm run db:seed
   ```

---

## SSL/HTTPS Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Stop nginx (if running)
docker-compose stop nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Update docker-compose.yml volumes:
volumes:
  - /etc/letsencrypt/live/yourdomain.com:/etc/nginx/ssl:ro
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro

# Restart nginx
docker-compose up -d nginx
```

### Option 2: Self-Signed (Development)

```bash
mkdir -p nginx/ssl
cd nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/CN=localhost"

cd ../..
docker-compose restart nginx
```

### Auto-Renewal

Add cron job:
```bash
sudo crontab -e

# Add line:
0 0 * * 0 certbot renew --quiet && docker-compose restart nginx
```

---

## Environment Configuration

### Production `.env.production`

```env
# Database
DATABASE_URL="postgresql://realtyuser:STRONG_PASSWORD@postgres:5432/realty_agency?schema=public"
POSTGRES_USER=realtyuser
POSTGRES_PASSWORD=STRONG_PASSWORD
POSTGRES_DB=realty_agency

# Auth (CRITICAL - MUST CHANGE)
NEXTAUTH_SECRET="GENERATE_WITH_openssl_rand_base64_32"
NEXTAUTH_URL="https://yourdomain.com"

# App
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### Security Checklist

- ✅ Change all default passwords
- ✅ Use strong `NEXTAUTH_SECRET` (32+ characters)
- ✅ Enable HTTPS/SSL
- ✅ Configure firewall (only ports 80, 443, 22)
- ✅ Regular security updates
- ✅ Strong PostgreSQL password

---

## Backup & Restore

### Automated Backups

```bash
# Manual backup
bash scripts/backup-db.sh

# Schedule daily backups (cron)
crontab -e

# Add line (daily at 2 AM):
0 2 * * * cd /path/to/project && bash scripts/backup-db.sh >> backup.log 2>&1
```

Backups stored in `./backups/` with 30-day retention.

### Restore Database

```bash
# List backups
ls -lh backups/

# Restore specific backup
bash scripts/restore-db.sh backups/backup_20241221_140000.sql.gz
```

---

## Monitoring & Maintenance

### Health Check

```bash
# Check application health
curl http://localhost:3000/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

### View Logs

```bash
# Application logs
docker-compose logs -f app

# PostgreSQL logs
docker-compose logs -f postgres

# Nginx logs
docker-compose logs -f nginx

# Or all services
docker-compose logs -f
```

### Container Management

```bash
# View running containers
docker-compose ps

# Restart specific service
docker-compose restart app

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# Stop and remove volumes (CAUTION: DATA LOSS)
docker-compose down -v
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose --env-file .env.production up -d

# Run migrations (if needed)
docker-compose exec app npx prisma db push
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Common issues:
# 1. Port already in use
sudo lsof -i :3000
sudo kill -9 <PID>

# 2. Database not ready
docker-compose logs postgres
docker-compose restart postgres

# 3. Environment variables missing
docker-compose exec app env | grep DATABASE_URL
```

### Database Connection Errors

```bash
# Test PostgreSQL connection
docker-compose exec postgres psql -U realtyuser -d realty_agency

# If connection fails:
# 1. Check credentials in .env.production
# 2. Ensure postgres container is running
docker-compose ps postgres

# 3. Check postgres logs
docker-compose logs postgres
```

### SSL Certificate Issues

```bash
# Verify certificate files exist
ls -l /etc/letsencrypt/live/yourdomain.com/

# Test nginx configuration
docker-compose exec nginx nginx -t

# Renew certificate manually
sudo certbot renew
docker-compose restart nginx
```

### Application Not Accessible

```bash
# Check if nginx is running
docker-compose ps nginx

# Test connectivity
curl -I http://localhost

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check DNS
nslookup yourdomain.com
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a

# Remove old backups
rm backups/backup_2024*.sql.gz

# Clean logs
truncate -s 0 nginx/logs/*.log
```

---

## Default Credentials

**After deployment, login with:**
- Email: `owner@agency.local`
- Password: `owner12345`

**⚠️ IMPORTANT:** Change password immediately after first login!

---

## Support & Documentation

- **GitHub**: https://github.com/bobrihha/ab-realty-accounting-system
- **Issues**: Report bugs on GitHub Issues
- **Documentation**: See README.md

---

## Production Checklist

Before going live:

- [ ] Domain configured and DNS resolving
- [ ] SSL certificate installed
- [ ] Strong passwords set (database, NEXTAUTH_SECRET)
- [ ] Firewall configured (ports 80, 443 only)
- [ ] Automated backups scheduled
- [ ] Health check endpoint responding
- [ ] All services running (`docker-compose ps`)
- [ ] Default owner password changed
- [ ] Monitoring/alerts configured (optional)
- [ ] Documentation reviewed by team

---

**Last Updated**: 2024-12-21
**Version**: 1.0.0
