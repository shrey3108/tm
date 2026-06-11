ALTER TABLE candidate_test_papers 
ADD COLUMN IF NOT EXISTS email_sent_count INTEGER NOT NULL DEFAULT 0;
