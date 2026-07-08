# Runbook — Customer 360 3A pre-launch timeline catch-up

**When:** once, before flipping the OrganizationDetailPage default view to the materialized timeline.
**What:** materialize any historical structured interactions (RFQ/Lead/Order/Quote/Logistics) not yet in `TimelineEvent`, by running the existing cold reconciliation sweep to completion. Analytics is forward-only and intentionally NOT backfilled.

## Steps
1. Find the crm-api Lambda:
   `aws lambda list-functions --region us-east-2 --query "Functions[?contains(FunctionName,'crm-api')].FunctionName" --output text`
2. Loop the cold sweep until it reports completion (it resumes from its own persisted cursor between invokes; the daily cron shares the same cursor and cooperates):
   ```bash
   FN=<crm-api function name>
   while :; do
     aws lambda invoke --region us-east-2 --function-name "$FN" \
       --cli-binary-format raw-in-base64-out \
       --payload '{"action":"reconcileSweep","mode":"cold"}' /tmp/out.json >/dev/null
     cat /tmp/out.json
     python3 -c "import json,sys; s=json.load(open('/tmp/out.json')).get('summary',{}).get('existence',{}); sys.exit(0 if s.get('hasMore') else 1)" || break
   done
   ```
3. Confirm coverage from the last `crm.sweep.summary` log: the existence counters must satisfy `expected = existing + missingReemitted + errors`, with `errors == 0`. `sourceScanned` shows how many source records were expanded.
4. Spot-check a couple of known historical customers in the admin UI: their RFQ/Order/Quote events now appear in the unified timeline.

## Rollback
None required — the sweep is idempotent (deterministic ids; re-runs only hit `existing`). If `errors > 0`, inspect the `crm.sweep.existence.error` / `expand_error` logs and re-run.
