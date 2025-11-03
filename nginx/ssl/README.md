# SSL Certificate Setup

This directory should contain your SSL certificates for HTTPS.

## Required Files

- `fullchain.pem` - Full certificate chain
- `privkey.pem` - Private key

## Obtaining SSL Certificates

### Using Let's Encrypt (Recommended)

1. Install Certbot:
   ```bash
   # On Ubuntu/Debian
   sudo apt update
   sudo apt install certbot

   # On CentOS/RHEL
   sudo yum install certbot
   ```

2. Obtain certificate:
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
   ```

3. Copy certificates to this directory:
   ```bash
   sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./fullchain.pem
   sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./privkey.pem
   ```

4. Set proper permissions:
   ```bash
   sudo chown nginx:nginx *.pem
   sudo chmod 600 *.pem
   ```

### Using Self-Signed Certificates (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout privkey.pem -out fullchain.pem -days 365 -nodes -subj "/CN=localhost"
```

**⚠️ Warning:** Self-signed certificates should only be used for development. Use proper certificates for production.

## Certificate Renewal

For Let's Encrypt certificates, set up automatic renewal:

```bash
# Add to crontab
0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

## Security Notes

- Keep private keys secure and never commit them to version control
- Regularly rotate certificates before expiration
- Use strong cipher suites as configured in nginx.conf
- Enable HSTS headers for additional security