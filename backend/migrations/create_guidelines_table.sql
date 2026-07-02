-- Migration: Create guidelines table
-- Description: Stores custom guideline templates to be assigned to test papers sent to candidates.

CREATE TABLE IF NOT EXISTS guidelines (
    id UUID PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
