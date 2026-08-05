#!/usr/bin/env bash
#
# check_stream_route.sh - does a Logstash-shaped write actually reach the
# partition, or only the parent stream?
#
# WHY THIS EXISTS
#
# The SPARTA schema lands everything on a *wired stream* (`logs.ecs`) and lets
# Streams Processing route each event to a child partition and run the ECS
# overlay server-side. Wired streams have their own bulk endpoint. Per the
# schema's own ingest doc:
#
#   "Use stream_bulk ... not the regular Elasticsearch _bulk API. es_bulk
#    bypasses the wired-stream layer and writes directly to the backing data
#    stream - documents are not partition-routed and do not run the processing
#    chain."
#
# Logstash's elasticsearch output writes through _bulk. So the config in
# pisat-shipper (`index => "logs.ecs"`, `action => "create"`) may land data that
# looks perfectly healthy in Discover while silently skipping partition routing
# and the ECS overlay - which means no detection ever fires.
#
# This sends ONE synthetic command document the same way Logstash would, waits
# for the refresh, and then asks the only question that matters: did it show up
# in logs.ecs.spacecraft.commands, or only in the parent?
#
# USAGE
#   ES_URL=https://192.168.1.10:9200 ES_AUTH='elastic:changeme' ./check_stream_route.sh
#   ES_URL=https://host:9200 ES_APIKEY='id:secret' ./check_stream_route.sh
#
# Leaves one document behind, tagged so you can find and delete it:
#   probe.id = <the marker printed below>

set -uo pipefail

ES_URL="${ES_URL:-http://localhost:9200}"
PARENT="${PARENT:-logs.ecs}"
CHILD="${CHILD:-logs.ecs.spacecraft.commands}"
MARK="route-probe-$(date +%s)"

if [ -n "${ES_APIKEY:-}" ]; then
  AUTH=(-H "Authorization: ApiKey $(printf '%s' "$ES_APIKEY" | base64)")
elif [ -n "${ES_AUTH:-}" ]; then
  AUTH=(-u "$ES_AUTH")
else
  AUTH=()
fi
# bash 3.2 (the macOS default) treats "${EMPTY[@]}" as unbound under `set -u`,
# so build the curl command with the auth flags folded in rather than expanded
# separately at every call site.
if [ ${#AUTH[@]} -eq 0 ]; then
  CURL=(curl -sk -m 20)
else
  CURL=(curl -sk -m 20 "${AUTH[@]}")
fi

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[32mPASS\033[0m  %s\n' "$*"; }
no()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; }
hm()  { printf '  ----  %s\n' "$*"; }

# ---------------------------------------------------------------- 0. cluster
say "0 - cluster"
INFO="$("${CURL[@]}" "$ES_URL")" || { no "cannot reach $ES_URL"; exit 1; }
VER="$(printf '%s' "$INFO" | python3 -c 'import sys,json;print(json.load(sys.stdin)["version"]["number"])' 2>/dev/null)"
if [ -z "$VER" ]; then no "no version in response - check auth"; echo "$INFO" | head -3; exit 1; fi
hm "version $VER"
case "$VER" in
  9.4*|9.5*|9.6*|9.7*|9.8*|9.9*|10.*) ok "9.4+ - wired Streams available" ;;
  *) no "$VER is below 9.4 - the wired-stream feature the schema assumes may be absent" ;;
esac

# ------------------------------------------------------- 1. does the stream exist
say "1 - streams"
STREAMS="$("${CURL[@]}" "$ES_URL/_streams/logs/_list" 2>/dev/null)"
if printf '%s' "$STREAMS" | grep -q "$PARENT"; then
  ok "$PARENT is a wired stream"
  printf '%s' "$STREAMS" | grep -o "logs\.ecs[a-z.]*" | sort -u | sed 's/^/        /'
else
  no "$PARENT not listed as a wired stream (the _streams API may not exist on $VER)"
  hm "raw: $(printf '%s' "$STREAMS" | head -c 200)"
fi

# --------------------------------------------------------------- 2. the write
# Exactly the shape Logstash sends: _bulk, action "create", index = the parent.
say "2 - write one document the way Logstash does"
BODY=$(cat <<JSON
{"create":{"_index":"$PARENT"}}
{"@timestamp":"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)","event":{"module":"space","dataset":"space.command"},"probe":{"id":"$MARK"},"source":{"ip":"10.13.37.42"},"destination":{"ip":"10.13.37.1"},"target_name":"CFDP","command":{"name":"DOWNLOAD_FROM_SATELLITE_CC","opcode":29},"primaryHeader":{"apid":90,"sequenceCount":0,"packetDataLength":129},"message":"stream routing probe"}
JSON
)
RESP="$("${CURL[@]}" -H 'Content-Type: application/x-ndjson' -XPOST "$ES_URL/_bulk?refresh=wait_for" --data-binary "$BODY")"
if printf '%s' "$RESP" | grep -q '"errors":true'; then
  no "bulk write rejected"
  printf '%s' "$RESP" | head -c 600; echo
  exit 1
fi
ok "accepted (marker $MARK)"

# ------------------------------------------------------------- 3. the verdict
say "3 - where did it land?"
sleep 2
count () {
  "${CURL[@]}" -H 'Content-Type: application/json' \
    "$ES_URL/$1/_count" -d "{\"query\":{\"term\":{\"probe.id\":\"$MARK\"}}}" 2>/dev/null \
  | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("count","?"))
except Exception: print("err")' 2>/dev/null
}
P="$(count "$PARENT")"
C="$(count "$CHILD")"
hm "$PARENT           -> $P"
hm "$CHILD  -> $C"

say "VERDICT"
if [ "$C" = "1" ]; then
  ok "Partition routing WORKS through Logstash's _bulk path."
  echo "        The pisat-shipper output block is fine as written."
elif [ "$P" = "1" ]; then
  no "Landed in the parent but NOT the partition."
  cat <<'TXT'
        This is the silent failure. Data looks healthy in Discover, but the
        ECS overlay never runs and no SPARTA detection can fire.
        Fixes, cheapest first:
          1. Point Logstash at the wired-stream bulk endpoint with an `http`
             output instead of the `elasticsearch` output.
          2. Or drop wired Streams for this feed: write to an ordinary data
             stream named logs.ecs.spacecraft.commands and do the ECS overlay
             in a classic ingest pipeline.
TXT
else
  no "Document not found in either. Check the marker by hand:"
  echo "        GET $PARENT/_search  {\"query\":{\"term\":{\"probe.id\":\"$MARK\"}}}"
fi

say "cleanup"
echo "  curl -k${ES_AUTH:+ -u '$ES_AUTH'} -XPOST '$ES_URL/$PARENT/_delete_by_query?refresh' \\"
echo "       -H 'Content-Type: application/json' -d '{\"query\":{\"term\":{\"probe.id\":\"$MARK\"}}}'"
