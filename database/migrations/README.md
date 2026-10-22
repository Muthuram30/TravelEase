# Database Migrations

Run **on a fresh database**, in exactly this order, after importing `../schema.sql`:

```powershell
mysql -u root -p tourism_db < ../schema.sql
# Then, in order:
mysql -u root -p tourism_db < 001_phase2_schema_normalization_fixed.sql
mysql -u root -p tourism_db < 002_simple_migration.sql
mysql -u root -p tourism_db < 003_food_platform.sql
mysql -u root -p tourism_db < 004_user_accounts.sql
mysql -u root -p tourism_db < 005_smart_travel_assistant.sql
mysql -u root -p tourism_db < 006_sample_recommendation_data.sql
mysql -u root -p tourism_db < 007_users_table.sql
mysql -u root -p tourism_db < 008_premium_roles_system.sql
mysql -u root -p tourism_db < 009_standardize_schema_columns.sql
mysql -u root -p tourism_db < 010_add_package_cover_image.sql
mysql -u root -p tourism_db < 011_upi_payment_system.sql
mysql -u root -p tourism_db < 012_booking_pay_later.sql
mysql -u root -p tourism_db < 013_fix_booking_constraints_demo_payment.sql
mysql -u root -p tourism_db < 014_local_package_images.sql
mysql -u root -p tourism_db < 015_booking_decisions_admin_audit.sql
```

All migrations are **additive and idempotent** — they check `INFORMATION_SCHEMA` before altering, so re-running an already-applied migration is a safe no-op. On an existing database, run only the migrations you are missing (the numbering above reflects the intended schema history).

## Why the numbering looks sparse

- The duplicate `001`/`004`/`007`–`010` files that used to share numbers were either **superseded** or **unsafe**; they now live in `archive/` and must NOT be run:
  - `archive/001_phase2_schema_normalization_superseded.sql` — replaced by `_fixed`
  - `archive/004_users_authentication_destructive.sql` — contained `DROP TABLE users` and hardcoded demo credentials; replaced by `007_users_table.sql`
- `admin`/`user_account` compatibility is handled by `004_user_accounts.sql` **and** at runtime by `backend/setup_admin.php`.
- After applying `007_users_table.sql`, create your admin with `php backend/setup_admin.php` — no default admin passwords exist in any migration.
- `014_local_package_images.sql` rewrites the seeded packages' image URLs (packages 1–10) from remote Unsplash to the local artwork in `backend/storage/uploads/packages/`. It only touches packages 1–10 and is safe to re-run.
