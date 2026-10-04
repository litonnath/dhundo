# Backup before the two-mode rebuild (4 October 2026)

## Code
Everything up to the commit below is saved on the branch claude/epic-carson-1igflg and is the last version
before the "I need / I offer" rebuild:

    75577f6375b51c19b30443b86ba1097fefb4099d

To go back to it:

    git fetch origin claude/epic-carson-1igflg
    git checkout -b restore-point 75577f6
    npm install && npm run deploy

(A separate backup branch and tag could not be pushed from the build environment, so the commit above is
the restore point. To make a permanent tag yourself: `git tag backup-before-modes 75577f6 && git push origin backup-before-modes`.)

## Database (do this yourself; the build environment cannot reach it)
1. Supabase, Database, Backups: on the free plan there are none, so export now:
   - SQL editor, or from a terminal with the connection string (Project Settings, Database):
     `pg_dump "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres" -Fc -f dhundo-2026-10-04.dump`
   - Storage files (photos, ID photos): download the buckets from Supabase, Storage, or copy with the S3 tools.
2. Keep the dump and the files somewhere that is not the same server.
3. To restore: `pg_restore --clean --if-exists -d "CONNECTION_STRING" dhundo-2026-10-04.dump`.

## Server files
`sudo tar czf ~/dhundo-server-backup-$(date +%F).tgz /var/www/services ~/services-app /etc/nginx` and copy it off the server.
