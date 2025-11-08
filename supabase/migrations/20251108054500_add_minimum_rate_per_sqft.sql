ALTER TABLE buildings
ADD COLUMN minimum_rate_per_sqft numeric NOT NULL DEFAULT 0;

-- Set the minimum_rate_per_sqft equal to rate_per_sqft for existing records
UPDATE buildings
SET minimum_rate_per_sqft = rate_per_sqft
WHERE minimum_rate_per_sqft = 0;