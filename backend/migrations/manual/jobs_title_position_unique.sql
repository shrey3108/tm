-- =============================================================================
-- ONE-SHOT MIGRATION — jobs (title + position_id) partial unique on active rows
-- =============================================================================
-- pgAdmin me Query Tool kholo → ye PURI file paste karo → F5 dabao.
-- Sab kuch ek transaction me chalega — koi bhi step fail hua to AUTOMATIC ROLLBACK
-- ho jayega aur DB pehle jaisa rahega.
--
-- Kya karta hai:
--   1. Old UNIQUE(title) constraint drop.
--   2. NULL position_id rows aur active duplicate (title,position_id) pairs check.
--      Mile to RAISE EXCEPTION → rollback. Tumhe data clean karna padega pehle.
--   3. position_id NOT NULL banata hai.
--   4. FK ondelete SET NULL → RESTRICT.
--   5. Partial UNIQUE INDEX (title, position_id) WHERE is_active = true.
--   6. Verification block.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    old_unique_name TEXT;
    null_position_count INT;
    duplicate_active_count INT;
BEGIN
    -- ----- STEP 1: Find and drop the old single-column UNIQUE on title -----
    SELECT conname
      INTO old_unique_name
    FROM pg_constraint
    WHERE conrelid = 'jobs'::regclass
      AND contype  = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (title)';

    IF old_unique_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE jobs DROP CONSTRAINT %I', old_unique_name);
        RAISE NOTICE 'Dropped old constraint: %', old_unique_name;
    ELSE
        RAISE NOTICE 'No standalone UNIQUE(title) constraint found — skipping drop.';
    END IF;

    -- ----- STEP 2: Pre-flight — NULL position_id rows -----
    SELECT COUNT(*) INTO null_position_count
    FROM jobs
    WHERE position_id IS NULL;

    IF null_position_count > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % job(s) have NULL position_id. '
            'Assign a valid position_id or delete those rows, then re-run.',
            null_position_count;
    END IF;

    -- ----- STEP 3: Pre-flight — active duplicate (title,position_id) pairs -----
    SELECT COUNT(*) INTO duplicate_active_count
    FROM (
        SELECT 1
        FROM jobs
        WHERE is_active = true
        GROUP BY lower(title), position_id
        HAVING COUNT(*) > 1
    ) d;

    IF duplicate_active_count > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % duplicate active (title, position_id) group(s) found. '
            'Deactivate (is_active=false) all but one in each group, then re-run.',
            duplicate_active_count;
    END IF;

    -- ----- STEP 4: position_id NOT NULL -----
    ALTER TABLE jobs ALTER COLUMN position_id SET NOT NULL;
    RAISE NOTICE 'position_id is now NOT NULL.';

    -- ----- STEP 5: FK ondelete: SET NULL → RESTRICT -----
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_position_id_fkey;
    ALTER TABLE jobs
        ADD CONSTRAINT jobs_position_id_fkey
        FOREIGN KEY (position_id) REFERENCES job_positions(id) ON DELETE RESTRICT;
    RAISE NOTICE 'FK jobs_position_id_fkey now uses ON DELETE RESTRICT.';

    -- ----- STEP 6: Partial UNIQUE INDEX on active rows -----
    DROP INDEX IF EXISTS uq_jobs_title_position_active;
    CREATE UNIQUE INDEX uq_jobs_title_position_active
        ON jobs (title, position_id)
        WHERE is_active = true;
    RAISE NOTICE 'Partial unique index uq_jobs_title_position_active created.';
END $$;

COMMIT;


-- =============================================================================
-- POST-MIGRATION VERIFICATION (separately runnable; not inside the transaction)
-- =============================================================================
-- Constraints
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'jobs'::regclass
ORDER BY conname;

-- Indexes (expect uq_jobs_title_position_active here)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'jobs'
ORDER BY indexname;

-- Column nullability (expect title=NO, position_id=NO)
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('title', 'position_id');


-- =============================================================================
-- ROLLBACK (if needed — run separately, after the migration was committed)
-- =============================================================================
-- BEGIN;
--   DROP INDEX IF EXISTS uq_jobs_title_position_active;
--   ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_position_id_fkey;
--   ALTER TABLE jobs
--       ADD CONSTRAINT jobs_position_id_fkey
--       FOREIGN KEY (position_id) REFERENCES job_positions(id) ON DELETE SET NULL;
--   ALTER TABLE jobs ALTER COLUMN position_id DROP NOT NULL;
--   ALTER TABLE jobs ADD CONSTRAINT jobs_title_key UNIQUE (title);
-- COMMIT;
