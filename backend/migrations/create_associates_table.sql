-- Migration: Create associates table
-- Description: Creates the associates table to store external collaborators / interviewers / panelists.

CREATE TABLE IF NOT EXISTS associates (
    id    UUID PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);
