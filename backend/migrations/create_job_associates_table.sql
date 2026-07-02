-- Migration: Create job_associates table
-- Description: Creates the junction table between jobs and associates for assignment.

CREATE TABLE IF NOT EXISTS job_associates (
    job_id UUID NOT NULL,
    associate_id UUID NOT NULL,
    PRIMARY KEY (job_id, associate_id),
    CONSTRAINT fk_job_associates_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
    CONSTRAINT fk_job_associates_associate FOREIGN KEY (associate_id) REFERENCES associates (id) ON DELETE CASCADE
);
