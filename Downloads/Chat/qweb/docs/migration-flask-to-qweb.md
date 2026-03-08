# Flask -> qweb Migration Plan

## Source tables
- users
- groups
- group_members
- messages
- message_reads
- file_uploads
- security_logs

## Phases
1. Preparation
- Freeze schema in Flask
- Export baseline snapshots from SQLite
- Build ETL mappings for IDs and normalized enums

2. Backfill
- Load users, rooms, memberships, messages, receipts, attachments, logs into PostgreSQL
- Verify row counts and foreign key integrity checks

3. Dual Write
- Keep Flask as primary read path
- Mirror new writes from Flask to qweb using queue/webhook
- Monitor lag and reconciliation reports

4. Cutover
- Put Flask in read-only mode
- Run final delta migration
- Switch DNS/ingress to qweb

5. Rollback
- Keep Flask hot for 72 hours
- Roll back DNS/ingress if severity-1 issue appears
- Replay queued events after patch if rolling forward again
