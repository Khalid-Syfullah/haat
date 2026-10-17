-- The store is now Tuktak Bazaar. If Admin → Settings was ever saved, the old placeholder
-- name and support address are stored in the "app" settings row; replace them, and nothing else.
UPDATE "Setting"
SET "value" = jsonb_set("value"::jsonb, '{store,name}', '"Tuktak Bazaar"'), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'app' AND "value"::jsonb #>> '{store,name}' = 'Haat';

UPDATE "Setting"
SET "value" = jsonb_set("value"::jsonb, '{store,supportEmail}', '"support@tuktakbazaar.com"'), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'app' AND "value"::jsonb #>> '{store,supportEmail}' = 'support@haat.example';
