Database migration (create `users` table)
---------------------------------------

If you're running the local MySQL instance used by this project, apply the migration in `api/migrations/001-create-users-table.sql` to ensure the `users` table exists and has the columns expected by the API:

1. Connect to your MySQL/MariaDB (example using mysql client):

```bash
mysql -u root -p bulacan_flavors < api/migrations/001-create-users-table.sql
```

2. Restart the API after applying migration.

After that, you can use the frontend forms (Register/Login) which POST to `/api/auth/register` and `/api/auth/login` respectively.
