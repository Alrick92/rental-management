-- PostgreSQL initialization script
-- Enables required extensions and sets up RLS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- The application sets this per-transaction for RLS
ALTER DATABASE rental_management SET app.current_organization_id = '';
