# Daily Journal and Habit Dashboard

This Next.js app stores each account's hobbies, dated hobby check-ins, memorable moments, and sleep records in MySQL.

## Local MySQL setup with XAMPP

1. Start **MySQL** from the XAMPP control panel.
2. From the project root, import the schema:

   ```sh
   /Applications/XAMPP/xamppfiles/bin/mysql -u root < database/schema.sql
   ```

   If your MySQL root account requires a password, add `-p` and enter it at the prompt.
   For an existing installation with the earlier shared-data schema, run these migrations in order:

   ```sh
   /Applications/XAMPP/xamppfiles/bin/mysql -u root < database/migrations/001_accounts.sql
   /Applications/XAMPP/xamppfiles/bin/mysql -u root < database/migrations/002_sleep_hours.sql
   /Applications/XAMPP/xamppfiles/bin/mysql -u root < database/migrations/003_profile_password_reset.sql
   ```

   Add `-p` if required. The first migration preserves existing records as unassigned data; the second converts existing sleep start/wake times into hours; the third adds profile pictures and password reset tokens. Legacy records remain hidden from new accounts. Run each migration only once.
3. Copy `.env.example` to `.env.local` and set the connection values for your MySQL instance:

   ```sh
   cp .env.example .env.local
   ```

   `.env.local` is ignored by Git. Never commit database credentials.
4. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

The app's server-side API uses `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`. Restart the Next.js server after changing `.env.local`.

Password reset emails use SMTP. Set `APP_URL` to the public base URL of the app and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env.local`. Use port 465 for implicit TLS or port 587 for STARTTLS. In production, `APP_URL` must use HTTPS. Never commit SMTP credentials.

## Accounts

Register with a username, email, and password. Sign in with your username and password. The profile page lets signed-in users upload or remove a PNG, JPEG, or WebP profile picture (up to 2 MB) and change their password. Changing a password revokes all active sessions. Users can also request a password reset email; reset links contain a single-use token that expires after one hour. Resetting a password revokes all sessions and invalidates outstanding reset tokens. Passwords and reset tokens are stored as salted scrypt hashes and SHA-256 hashes, respectively. Every journal API requires a valid session and scopes records to its account. New accounts start with empty journals. Sleep is recorded as hours from 0 to 12 with up to two decimal places. Older browser-local data is left in the browser and is no longer imported automatically.

Run the checks with:

```sh
npm test
npm run lint
npm run build
```

## Existing data

The account migration preserves records from the earlier shared-data schema with no account assigned. They remain hidden from user accounts. Existing browser-local data also remains in localStorage and is not imported automatically.

## Security

The app uses database-backed sessions with HttpOnly, SameSite=Lax cookies and does not reveal whether an email address is registered when a reset is requested. Add rate limiting before exposing authentication endpoints to the public internet. Use HTTPS and a least-privilege MySQL account for deployments.
