# VPS Deployment – Pikkukirja

Your server: Ubuntu on OVHcloud. Steps below assume you can SSH in.

---

## 1. Install Node.js on the server

```bash
# SSH into your VPS first
ssh user@your-vps-ip

# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# Install Node 22
nvm install 22
node --version   # should print v22.x.x
```

---

## 2. Install PM2 (process manager — keeps the app running after reboot)

```bash
npm install -g pm2
```

---

## 3. Clone the repo on the server

```bash
# On the server
git clone <your-repo-url> ~/kirjanpito
```

---

## 4. Set up the app on the server

```bash
cd ~/kirjanpito

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create the production database directory
mkdir -p data

# Set environment variables (use a strong random value for AUTH_SECRET)
cat > .env <<'EOF'
DATABASE_URL="file:./data/prod.db"
AUTH_SECRET="replace-this-with-a-random-secret-at-least-32-chars"
AUTH_TRUST_HOST=true

# Encrypts TOTP (2FA) secrets at rest. Generate with the command below.
# Keep this key safe — losing it locks out all 2FA users.
TOTP_ENCRYPTION_KEY="replace-this-with-64-hex-chars"

# Optional: SMTP for sending invoices by email
# These env vars take priority over the UI settings (Admin → SMTP-asetukset).
# Leave commented out to configure SMTP through the admin UI instead.
# SMTP_HOST="smtp.example.com"
# SMTP_PORT="587"
# SMTP_USER="your@email.com"
# SMTP_PASS="your-smtp-password"
# SMTP_FROM="Yhdistyksen nimi <your@email.com>"   # optional, defaults to SMTP_USER
EOF

# Run database migrations
npx prisma migrate deploy

# Build the app
npm run build
```

Generate the required secrets:
```bash
# AUTH_SECRET (base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# TOTP_ENCRYPTION_KEY (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. Create the first admin user

Run this **once** after the first deploy to create your admin account:

```bash
cd ~/kirjanpito
mkdir -p scripts
cat > scripts/create-admin.mjs << 'EOF'
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const name = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

if (!name || !email || !password || password.length < 8) {
  console.error('Käyttö: node scripts/create-admin.mjs "Nimi" "email@example.com" "salasana"');
  process.exit(1);
}

const dbPath = (process.env.DATABASE_URL ?? 'file:./data/prod.db').replace('file:', '');
const db = new Database(dbPath);

const hash = await bcrypt.hash(password, 12);
const id = randomUUID().replace(/-/g, '');
const now = new Date().toISOString();

db.prepare(`INSERT INTO User (id, name, email, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'admin', ?, ?)`).run(id, name, email, hash, now, now);

console.log(`\nAdmin-käyttäjä luotu: ${name} <${email}>\n`);
db.close();
EOF

node scripts/create-admin.mjs "Nimi Sukunimi" "email@example.com" "salasana123"
```

After this, log in at the app and create other users through the admin panel (top-right → Käyttäjät).

---

## 6. Start with PM2

```bash
# Start the app (port 3000 by default)
pm2 start npm --name kirjanpito --cwd ~/kirjanpito -- start -- -p 3000

# Save PM2 config so it restarts on server reboot
pm2 save
pm2 startup   # follow the printed instructions to enable autostart
```

The app is now running at `http://your-vps-ip:3000`

---

## 7. (Optional) Set up Nginx reverse proxy with HTTPS

If you want to access it via a domain name with HTTPS:

```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/kirjanpito
```

Paste this (replace `yourdomain.fi`):

```nginx
# Rate-limit zone: max 10 requests/minute per IP on the login endpoint
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;

server {
    server_name yourdomain.fi;

    # Throttle login attempts to 10/min; burst of 5 without delay
    location /api/auth {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/kirjanpito /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get HTTPS certificate (free)
sudo certbot --nginx -d yourdomain.fi
```

---

## 8. Database backups

All persistent data lives in `~/kirjanpito/data/`:
- `prod.db` — the database
- `attachments/` — voucher attachment files (PDF, images)
- `smtp-config.json` — SMTP settings configured via admin UI
- `cron-config.json` — email reminder schedule and secret key
- `backup-config.json` — automatic backup schedule and secret key
- `report-schedule-config.json` — scheduled report delivery settings and secret key

### Manual backup

Download the database via the **Varmuuskopio** button in the admin panel (**Admin → Varmuuskopiointi**), or grab it directly from the server:

```bash
scp user@your-vps-ip:~/kirjanpito/data/prod.db ./prod-backup.db
```

### Automatic in-app backup (recommended)

The app has a built-in automatic backup feature. Configure it in the admin UI at **Admin → Varmuuskopiointi** (`/admin/backup`):

- Set a backup directory on the server (e.g. `/home/user/kirjanpito-backups`)
- Choose how many copies to keep (default: 7)
- Enable automatic backups, then add a cron job using the URL shown in the UI

Example crontab entry (every day at 03:00):
```
0 3 * * * curl -s "https://yourdomain.fi/api/cron/backup?key=YOUR_SECRET_KEY" > /dev/null
```

The backup cron copies `prod.db` with an ISO timestamp filename and automatically deletes the oldest copies beyond the configured limit.

### Full directory backup (belt-and-suspenders)

To also back up attachments and config files, add a separate cron job:

```bash
crontab -e
```

Add:
```
0 3 * * * tar -czf ~/backups/kirjanpito_$(date +\%Y\%m\%d).tar.gz -C ~/kirjanpito data/
```

---

## 9. Automated cron jobs (optional)

The app has three cron endpoints. Configure each in the admin panel — the UI shows the full URL with the secret key.

| Endpoint | Admin UI | Description |
|----------|----------|-------------|
| `/api/cron/reminders` | Admin → Muistutukset | Send payment reminders for unpaid invoices |
| `/api/cron/backup` | Admin → Varmuuskopiointi | Copy the database to a backup directory |
| `/api/cron/report-delivery` | Admin → Raportit | Email an invoice aging or income statement report |

Example crontab entries (replace URLs with the ones shown in the admin UI):

```
# Payment reminders — every day at 08:00
0 8 * * * curl -s -H "Authorization: Bearer YOUR_KEY" "https://yourdomain.fi/api/cron/reminders" > /dev/null

# Automatic database backup — every day at 03:00
0 3 * * * curl -s -H "Authorization: Bearer YOUR_KEY" "https://yourdomain.fi/api/cron/backup" > /dev/null

# Weekly report email — every Monday at 08:00
0 8 * * 1 curl -s -H "Authorization: Bearer YOUR_KEY" "https://yourdomain.fi/api/cron/report-delivery" > /dev/null
```

SMTP must be configured (env vars or Admin → SMTP-asetukset) for email features to work.

---

## Updating the app

When you make changes locally, push to git, then on the server:

```bash
cd ~/kirjanpito
git pull
npm install
npx prisma migrate deploy
npx prisma generate   # ← required whenever the schema changed
npm run build
pm2 restart kirjanpito
```

> **Note:** `prisma migrate deploy` applies SQL migrations but does NOT regenerate the TypeScript client.
> Always run `prisma generate` after it, otherwise the build will fail with "Property X does not exist" errors.

---

## Importing historical data from Holli/Tappio (.tlk files)

If you have old bookkeeping years from the Holli/Tappio program, use the import script to bring them in as closed fiscal years.

### 1. Find the association ID

```bash
npx tsx scripts/import-tlk.ts --list-associations
```

### 2. Preview without writing anything

```bash
npx tsx scripts/import-tlk.ts --dry-run <association-id> "path/to/file.tlk"
```

### 3. Import

```bash
npx tsx scripts/import-tlk.ts <association-id> "path/to/file.tlk"
```

Run once per file. If you have multiple years, import each file separately. Running the same file twice is safe — existing vouchers are skipped.

The fiscal year is created with status `closed`. Accounts are upserted, so they won't be duplicated if they already exist from a previous import.

---

## Database maintenance (via command line)

There is no delete button for organizations or fiscal years in the UI — this is intentional to prevent accidents. Use the SQLite CLI directly on the server.

### Open the database

```bash
sqlite3 ~/kirjanpito/data/prod.db
```

### List organizations and fiscal years

```sql
-- All organizations
SELECT id, name, type FROM Association;

-- Fiscal years for a specific organization (replace ORG_ID)
SELECT id, year, status FROM FiscalYear WHERE associationId = 'ORG_ID';
```

### Delete a fiscal year

This removes the fiscal year and all its vouchers, invoices, and budget entries.

```sql
-- Replace FY_ID with the actual fiscal year id from the SELECT above
DELETE FROM Invoice WHERE fiscalYearId = 'FY_ID';
DELETE FROM Voucher WHERE fiscalYearId = 'FY_ID';
DELETE FROM FiscalYear WHERE id = 'FY_ID';
```

> **Note:** The SQL above cascade-deletes `VoucherAttachment` rows from the database, but the actual files in `data/attachments/` are **not** removed. Clean them up manually if needed — or simply leave them; they take up little space and the backup covers the whole `data/` directory.

### Delete an entire organization

This removes the organization and everything in it: all fiscal years, members, accounts, and invoices.

```sql
-- Replace ORG_ID with the actual organization id from the SELECT above
DELETE FROM Invoice  WHERE fiscalYearId IN (SELECT id FROM FiscalYear WHERE associationId = 'ORG_ID');
DELETE FROM Voucher  WHERE fiscalYearId IN (SELECT id FROM FiscalYear WHERE associationId = 'ORG_ID');
DELETE FROM FiscalYear WHERE associationId = 'ORG_ID';
DELETE FROM Member   WHERE associationId = 'ORG_ID';
DELETE FROM Account  WHERE associationId = 'ORG_ID';
DELETE FROM Association WHERE id = 'ORG_ID';
```

> **Note:** Same as above — `VoucherAttachment` rows are cascade-deleted but files remain in `data/attachments/`. Clean up manually if needed.

Type `.quit` to exit the SQLite shell.

> **Tip:** Take a backup before deleting anything — see section 8, or use the **Varmuuskopio** button in the admin panel.

---

## Viewing the database on Windows

If you need to hand the app over to someone else or inspect the data outside the app, **DB Browser for SQLite** is the recommended tool for Windows:

- Download: https://sqlitebrowser.org/dl/
- Free and open source
- Open `prod.db` directly — browse all tables, run queries, export to CSV/Excel

The database is a single file (`data/prod.db`). Download it via the **Varmuuskopio** button in the admin panel, then open it in DB Browser.

Useful exports from DB Browser: File → Export → Table(s) as CSV — works for any table (invoices, members, vouchers, etc.) and opens directly in Excel.
