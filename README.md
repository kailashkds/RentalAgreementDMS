# QuickKaraar - Legal Document Management System

A comprehensive Document Management System (DMS) specifically designed for legal document generation and management. The application provides a web-based admin panel for creating, managing, and tracking legal documents with support for multiple languages and document types.

## Features

- **Multi-Document Support**: Rental agreements, promissory notes, power of attorney, and other legal documents
- **5-Step Document Creation Wizard** with step validation
- **Multi-Language Support**: English, Hindi, Gujarati, Tamil, Marathi
- **Client Management System** with default password authentication
- **Document Upload & Storage** with ACL-based access control
- **Responsive Design** with QuickKaraar branding
- **JSON-Based Data Storage** for flexible document field management

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling and development
- **Tailwind CSS** for styling
- **Shadcn/UI** component library
- **TanStack Query** for server state management
- **React Hook Form** with Zod validation
- **Wouter** for client-side routing

### Backend
- **Node.js** with Express.js
- **TypeScript** with ES modules
- **PostgreSQL** with Neon serverless hosting
- **Drizzle ORM** for database operations
- **Google Cloud Storage** for file management
- **Express Sessions** for authentication

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Google Cloud Storage bucket (optional, for file uploads)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd quickkaraar-dms
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create a `.env` file with the following variables:
```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Session Secret
SESSION_SECRET=your-super-secret-session-key

# Object Storage (Optional)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-id
PRIVATE_OBJECT_DIR=/your-bucket/private
PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket/public
```

4. **Database Setup**
```bash
# Push schema to database
npm run db:push
```

5. **Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Production Deployment

### Method 1: Traditional VPS/Server Deployment

#### Step 1: Server Preparation

1. **Update System**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Install Node.js 18+**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install PM2 (Process Manager)**
```bash
sudo npm install -g pm2
```

4. **Install Nginx**
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### Step 2: Application Setup

1. **Clone and Setup Application**
```bash
cd /var/www
sudo git clone <repository-url> quickkaraar
sudo chown -R $USER:$USER quickkaraar
cd quickkaraar

# Install dependencies
npm ci --production

# Build the application
npm run build
```

2. **Environment Configuration**
```bash
# Create production environment file
sudo nano .env.production

# Add production environment variables
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-production-session-secret
NODE_ENV=production
PORT=3000

# Object Storage (if using)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-production-bucket
PRIVATE_OBJECT_DIR=/your-bucket/private
PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket/public
```

3. **Database Migration**
```bash
# Push schema to production database
npm run db:push
```

#### Step 3: PM2 Configuration

1. **Create PM2 Ecosystem File**
```bash
sudo nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'quickkaraar-dms',
    script: 'server/index.js',
    cwd: '/var/www/quickkaraar',
    env_file: '.env.production',
    instances: 'max',
    exec_mode: 'cluster',
    error_file: '/var/log/quickkaraar/error.log',
    out_file: '/var/log/quickkaraar/out.log',
    log_file: '/var/log/quickkaraar/combined.log',
    time: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

2. **Create Log Directory**
```bash
sudo mkdir -p /var/log/quickkaraar
sudo chown -R $USER:$USER /var/log/quickkaraar
```

3. **Start Application with PM2**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Step 4: Nginx Configuration

1. **Create Nginx Site Configuration**
```bash
sudo nano /etc/nginx/sites-available/quickkaraar
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=1r/s;

    # Static files cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API routes with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # File upload handling
    location /api/objects/upload {
        client_max_body_size 10M;
        proxy_request_buffering off;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main application
    location / {
        limit_req zone=general burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}
```

2. **Enable Site and Test Configuration**
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/quickkaraar /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

#### Step 5: SSL Certificate (Let's Encrypt)

1. **Install Certbot**
```bash
sudo apt install certbot python3-certbot-nginx -y
```

2. **Obtain SSL Certificate**
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

3. **Auto-renewal Setup**
```bash
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

#### Step 6: Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

### Method 2: Docker Deployment

#### Step 1: Create Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S quickkaraar -u 1001

WORKDIR /app

COPY --from=builder --chown=quickkaraar:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=quickkaraar:nodejs /app/dist ./dist
COPY --from=builder --chown=quickkaraar:nodejs /app/server ./server
COPY --from=builder --chown=quickkaraar:nodejs /app/shared ./shared
COPY --from=builder --chown=quickkaraar:nodejs /app/package.json ./

USER quickkaraar

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server/index.js"]
```

#### Step 2: Docker Compose

```yaml
version: '3.8'

services:
  quickkaraar:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=quickkaraar
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - quickkaraar
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Step 3: Deploy with Docker

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f quickkaraar

# Stop services
docker-compose down
```

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Secret key for session encryption | Yes | `your-super-secret-key` |
| `NODE_ENV` | Environment mode | No | `production` |
| `PORT` | Server port | No | `3000` |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket ID | No | `your-bucket-id` |
| `PRIVATE_OBJECT_DIR` | Private files directory | No | `/bucket/private` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public files paths | No | `/bucket/public` |

## Database Schema

The application uses Drizzle ORM with the following main tables:

- **users**: Admin user accounts
- **customers**: Client information with default passwords
- **societies**: Property society/building database
- **agreements**: Legal document records with JSON data storage
- **sessions**: Session storage for authentication

## File Storage

- **Local Development**: Files stored in memory (MemStorage)
- **Production**: Google Cloud Storage with ACL-based permissions
- **Supported Formats**: PDF, JPG, PNG (max 5MB per file)

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user
- `POST /api/login` - User login
- `POST /api/logout` - User logout

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer

### Societies
- `GET /api/societies` - List societies
- `POST /api/societies` - Create society

### Agreements
- `GET /api/agreements` - List agreements
- `POST /api/agreements` - Create agreement
- `PUT /api/agreements/:id` - Update agreement
- `DELETE /api/agreements/:id` - Delete agreement

### File Upload
- `POST /api/objects/upload` - Get upload URL
- `GET /objects/:path` - Serve private files
- `GET /public-objects/:path` - Serve public files

## Monitoring and Maintenance

### PM2 Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs quickkaraar-dms

# Restart application
pm2 restart quickkaraar-dms

# Reload application (zero downtime)
pm2 reload quickkaraar-dms

# Monitor resources
pm2 monit
```

### Nginx Commands
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Database Maintenance
```bash
# Backup database
pg_dump $DATABASE_URL > backup.sql

# Restore database
psql $DATABASE_URL < backup.sql

# Check database connections
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
```

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Check environment variables in `.env.production`
   - Verify database connection
   - Check PM2 logs: `pm2 logs quickkaraar-dms`

2. **502 Bad Gateway**
   - Ensure application is running on correct port
   - Check nginx configuration
   - Verify proxy_pass URL in nginx config

3. **File uploads failing**
   - Check `client_max_body_size` in nginx
   - Verify Google Cloud Storage credentials
   - Check object storage environment variables

4. **Database connection errors**
   - Verify DATABASE_URL format
   - Check database server status
   - Ensure database exists and user has permissions

### Performance Optimization

1. **Enable HTTP/2**
```nginx
listen 443 ssl http2;
```

2. **Add Brotli Compression**
```bash
sudo apt install nginx-module-brotli
```

3. **Database Indexing**
```sql
CREATE INDEX idx_agreements_customer_id ON agreements(customer_id);
CREATE INDEX idx_agreements_created_at ON agreements(created_at);
```

4. **Redis Session Store** (Optional)
```bash
npm install connect-redis redis
```

## Security Considerations

- All sensitive data encrypted in transit (HTTPS)
- Session-based authentication with secure cookies
- File upload restrictions and validation
- Rate limiting on API endpoints
- Input validation with Zod schemas
- SQL injection protection with Drizzle ORM

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push to branch: `git push origin feature-name`
6. Create a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For technical support or questions:
- Email: support@quickkaraar.com
- Documentation: [Internal Wiki]
- Issue Tracker: [Project Repository Issues]