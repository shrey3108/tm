-- 1. Create designations table
CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert distinct designations from associates
INSERT INTO designations (name)
SELECT DISTINCT designation FROM associates
WHERE designation IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 3. Add designation_id to associates
ALTER TABLE associates ADD COLUMN designation_id UUID;

-- 4. Map designation_id based on the string value
UPDATE associates
SET designation_id = designations.id
FROM designations
WHERE associates.designation = designations.name;

-- 5. Add foreign key constraint and make not null
ALTER TABLE associates
    ADD CONSTRAINT fk_associates_designation_id FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE RESTRICT;

ALTER TABLE associates ALTER COLUMN designation_id SET NOT NULL;

-- 6. Drop old designation column
ALTER TABLE associates DROP COLUMN designation;
