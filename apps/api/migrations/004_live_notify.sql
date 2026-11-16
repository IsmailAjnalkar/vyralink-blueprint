-- Real-time control center: any change to a booking, its metrics, incidents or readiness announces the location on
-- channel 'live' (payload = location id). Postgres folds identical notifications within one transaction.
CREATE OR REPLACE FUNCTION notify_live() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  bid uuid;
  loc uuid;
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    bid := NEW.id;
    IF TG_OP = 'UPDATE' AND OLD.booth_id <> NEW.booth_id THEN
      SELECT location_id INTO loc FROM booths WHERE id = OLD.booth_id;
      PERFORM pg_notify('live', loc::text);
    END IF;
  ELSE
    bid := NEW.booking_id;
  END IF;
  SELECT bo.location_id INTO loc FROM bookings b JOIN booths bo ON bo.id = b.booth_id WHERE b.id = bid;
  IF loc IS NOT NULL THEN
    PERFORM pg_notify('live', loc::text);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS live_bookings ON bookings;
CREATE TRIGGER live_bookings AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION notify_live();
DROP TRIGGER IF EXISTS live_metrics ON metric_entries;
CREATE TRIGGER live_metrics AFTER INSERT OR UPDATE ON metric_entries FOR EACH ROW EXECUTE FUNCTION notify_live();
DROP TRIGGER IF EXISTS live_incidents ON incidents;
CREATE TRIGGER live_incidents AFTER INSERT OR UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION notify_live();
DROP TRIGGER IF EXISTS live_readiness ON readiness;
CREATE TRIGGER live_readiness AFTER INSERT OR UPDATE ON readiness FOR EACH ROW EXECUTE FUNCTION notify_live();
