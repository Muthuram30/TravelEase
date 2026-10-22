# TravelEase - Production Deployment Guide

## 🚀 Deployment Checklist

### Step 1: Environment Configuration

**Backend (.env)**
```env
# Production Database
MYSQL_HOST=your_production_host
MYSQL_PORT=3306
MYSQL_DATABASE=tourism_db_prod
MYSQL_USER=travelease_user
MYSQL_PASSWORD=STRONG_PASSWORD_HERE

# Production Frontend URL
REACT_APP_URL=https://travelease.yourdomain.com

# Admin Credentials (Change immediately!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=VERY_STRONG_PASSWORD_123!

# OmniRoute (Optional - leave empty to use Ollama)
OMNIROUTE_BASE_URL=https://api.omniroute.ai
OMNIROUTE_API_KEY=your_api_key_here
OMNIROUTE_MODEL=gpt-4o-mini

# Contact
CONTACT_PHONE=9000000000

# Setup
SETUP_TOKEN=production-setup-token-2026
```

**Frontend (.env.production)**
```env
VITE_API_URL=https://api.travelease.yourdomain.com/api
```

### Step 2: Database Setup

```sql
-- 1. Create production database
CREATE DATABASE tourism_db_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Create dedicated user
CREATE USER 'travelease_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON tourism_db_prod.* TO 'travelease_user'@'localhost';
FLUSH PRIVILEGES;

-- 3. Run migrations
mysql -u travelease_user -p tourism_db_prod < database/migrations/002_simple_migration.sql
mysql -u travelease_user -p tourism_db_prod < database/migrations/003_food_platform.sql

-- 4. Verify tables
mysql -u travelease_user -p tourism_db_prod -e "SHOW TABLES;"
-- Should show 19 tables

-- 5. Seed admin user
php backend/setup_admin.php
```

### Step 3: Backend Deployment

```bash
# 1. Update Apache VirtualHost
sudo nano /etc/apache2/sites-available/travelease-api.conf
```

```apache
<VirtualHost *:443>
    ServerName api.travelease.yourdomain.com
    DocumentRoot /var/www/travelease/backend
    
    SSLEngine on
    SSLCertificateFile /path/to/ssl/cert.pem
    SSLCertificateKeyFile /path/to/ssl/key.pem
    
    <Directory /var/www/travelease/backend>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Enable mod_rewrite
        RewriteEngine On
        RewriteBase /
    </Directory>
    
    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    
    # CORS (adjust origin)
    Header always set Access-Control-Allow-Origin "https://travelease.yourdomain.com"
    Header always set Access-Control-Allow-Credentials "true"
    
    # Disable directory listing
    Options -Indexes
    
    # Prevent access to sensitive files
    <FilesMatch "\.(env|htaccess|log|sql)$">
        Require all denied
    </FilesMatch>
    
    ErrorLog ${APACHE_LOG_DIR}/travelease-api-error.log
    CustomLog ${APACHE_LOG_DIR}/travelease-api-access.log combined
</VirtualHost>
```

```bash
# 2. Enable site and restart
sudo a2ensite travelease-api
sudo systemctl restart apache2

# 3. Set permissions
sudo chown -R www-data:www-data /var/www/travelease/backend/storage
sudo chmod -R 755 /var/www/travelease/backend/storage

# 4. Verify backend
curl https://api.travelease.yourdomain.com/destinations/index.php
```

### Step 4: Frontend Deployment

```bash
# 1. Build optimized frontend
cd frontend
npm run build

# 2. Deploy to web server
rsync -avz dist/ /var/www/travelease/frontend/

# 3. Configure Nginx (or Apache)
sudo nano /etc/nginx/sites-available/travelease
```

```nginx
server {
    listen 443 ssl http2;
    server_name travelease.yourdomain.com;
    
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    root /var/www/travelease/frontend;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    error_log /var/log/nginx/travelease-error.log;
    access_log /var/log/nginx/travelease-access.log;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name travelease.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

```bash
# 4. Enable and restart
sudo ln -s /etc/nginx/sites-available/travelease /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: SSL/TLS Setup

```bash
# Using Let's Encrypt (free SSL)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d travelease.yourdomain.com -d api.travelease.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Step 6: Database Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup-travelease-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/travelease"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tourism_db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

mysqldump -u travelease_user -p'PASSWORD' tourism_db_prod | gzip > $BACKUP_FILE

# Keep only last 7 days
find $BACKUP_DIR -name "tourism_db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-travelease-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-travelease-db.sh
```

### Step 7: Monitoring Setup

**Log Monitoring**
```bash
# Apache API logs
sudo tail -f /var/log/apache2/travelease-api-error.log

# Nginx frontend logs
sudo tail -f /var/log/nginx/travelease-error.log

# MySQL slow queries
sudo nano /etc/mysql/my.cnf
```

```ini
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 2
```

**Health Check Endpoint**
Create `backend/api/health.php`:
```php
<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';

try {
    $db = getDbConnection();
    $stmt = $db->query("SELECT 1");
    echo json_encode(['status' => 'ok', 'database' => 'connected', 'timestamp' => time()]);
} catch (Exception $e) {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Database unavailable']);
}
```

**Monitoring Script**
```bash
#!/bin/bash
# health-check.sh
curl -f https://api.travelease.yourdomain.com/health.php || \
  echo "API DOWN!" | mail -s "TravelEase API Alert" admin@yourdomain.com
```

### Step 8: Performance Optimization

**PHP OpCache**
```bash
sudo nano /etc/php/8.1/apache2/conf.d/10-opcache.ini
```

```ini
opcache.enable=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=10000
opcache.revalidate_freq=60
```

**MySQL Query Cache**
```sql
-- Enable query cache
SET GLOBAL query_cache_size = 67108864; -- 64MB
SET GLOBAL query_cache_type = 1;

-- Add indexes for common queries
CREATE INDEX idx_booking_status ON booking(status);
CREATE INDEX idx_package_active ON tour_package(is_active, is_featured);
CREATE INDEX idx_food_location_active ON foodspot_location(is_active, city);
```

**CDN Integration (Optional)**
- Upload images to Cloudinary/AWS S3
- Update image URLs in database
- Set long cache headers

### Step 9: Security Hardening

**PHP Security**
```bash
sudo nano /etc/php/8.1/apache2/php.ini
```

```ini
display_errors = Off
display_startup_errors = Off
error_reporting = E_ALL & ~E_NOTICE & ~E_DEPRECATED
expose_php = Off
max_execution_time = 30
max_input_time = 60
memory_limit = 128M
post_max_size = 8M
upload_max_filesize = 5M
```

**Fail2Ban for API Protection**
```bash
sudo apt install fail2ban
sudo nano /etc/fail2ban/jail.local
```

```ini
[travelease-api]
enabled = true
port = http,https
filter = travelease-api
logpath = /var/log/apache2/travelease-api-access.log
maxretry = 10
bantime = 3600
```

**Firewall Rules**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### Step 10: Final Verification

```bash
# 1. Test API endpoints
curl https://api.travelease.yourdomain.com/packages/index.php
curl https://api.travelease.yourdomain.com/destinations/index.php
curl https://api.travelease.yourdomain.com/food/locations.php

# 2. Test frontend
curl -I https://travelease.yourdomain.com
# Should return 200 OK

# 3. Test SSL
openssl s_client -connect travelease.yourdomain.com:443 -servername travelease.yourdomain.com

# 4. Check permissions
ls -la /var/www/travelease/backend/storage
# Should be owned by www-data

# 5. Verify database connection
php backend/check_db.php
```

---

## 🔧 Post-Deployment Maintenance

### Weekly Tasks
- Review error logs
- Check disk space
- Monitor database size
- Review failed login attempts

### Monthly Tasks
- Update PHP/MySQL/OS packages
- Review and rotate SSL certificates
- Analyze slow query log
- Review backup integrity

### Quarterly Tasks
- Security audit
- Performance optimization review
- Database optimization (OPTIMIZE TABLE)
- Review user feedback for improvements

---

## 🆘 Troubleshooting

### Issue: API Returns 500 Errors
```bash
# Check PHP error log
sudo tail -100 /var/log/apache2/travelease-api-error.log

# Check database connection
php backend/check_db.php

# Verify .env file exists and has correct permissions
ls -la backend/.env
```

### Issue: Frontend Shows Blank Page
```bash
# Check browser console for errors
# Verify API_URL in frontend .env.production

# Rebuild frontend
cd frontend
rm -rf dist
npm run build

# Check Nginx config
sudo nginx -t
```

### Issue: Images Not Loading
```bash
# Check storage permissions
sudo chown -R www-data:www-data backend/storage
sudo chmod -R 755 backend/storage

# Verify .htaccess in storage directory
cat backend/storage/.htaccess
```

---

## ✅ Production Ready Checklist

- [ ] SSL certificate installed and auto-renewing
- [ ] Database backups running daily
- [ ] Error logging configured
- [ ] Monitoring/alerts set up
- [ ] Security headers enabled
- [ ] CORS restricted to production domain
- [ ] Admin credentials changed from defaults
- [ ] Database user has minimal privileges
- [ ] PHP display_errors = Off
- [ ] Firewall rules configured
- [ ] Performance optimizations applied
- [ ] Smoke-tested manually (bookings, admin login, image uploads)

---

**Deployment Time:** 2-4 hours  
**Difficulty:** Intermediate  
**Prerequisites:** Linux server, Apache/Nginx, PHP 8.1+, MySQL 8.0+
