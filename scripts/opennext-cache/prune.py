"""Deletes old deploys' page cache from the production R2 bucket, keeping the newest builds.

Every deploy writes the prebuilt pages to a new folder, `<prefix>/<buildId>/`, in the cache bucket
(`NEXT_INC_CACHE_R2_BUCKET` and `NEXT_INC_CACHE_R2_PREFIX` in wrangler.jsonc). The live site reads
only its own build's folder; the others stay until deleted. Keeping a few lets a rollback to a
recent version (Cloudflare dashboard) find its cached pages.

Run from the repository root:
    pnpm cache:prune                     # lists what it would keep and delete
    pnpm cache:prune --delete            # deletes, keeping the 5 newest builds
    pnpm cache:prune --delete --keep 3

"Newest" is by a folder's newest file: the live build keeps writing to its folder as pages are
revalidated. Anything under the prefix that isn't a build folder is left alone.

Credentials come from `wrangler auth token` (the Wrangler login, or CLOUDFLARE_API_TOKEN); the token
stays in this process and is never printed. The account is `account_id` in wrangler.jsonc. Deletes
go one by one through the Cloudflare API, paced under its limit of 1200 requests per 5 minutes per
user so a deploy running at the same time isn't refused (about 1 file a second).
"""
import argparse
import collections
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PACE = 0.5  # seconds between deletes: at most 600 per 5 minutes, half the API's limit

parser = argparse.ArgumentParser(description='Delete old builds from the OpenNext page cache in R2.')
parser.add_argument('--delete', action='store_true', help='delete (without it, only lists)')
parser.add_argument('--keep', type=int, default=5, help='how many of the newest builds to keep (default 5)')
args = parser.parse_args()
if args.keep < 1:
    sys.exit('--keep must be at least 1: the newest build is the live one')

config = open('wrangler.jsonc', encoding='utf-8').read()


def setting(pattern, name):
    match = re.search(pattern, config, re.S)
    if not match:
        sys.exit(f'wrangler.jsonc has no {name}; run from the repository root')
    return match.group(1)


account = setting(r'"account_id"\s*:\s*"([^"]+)"', 'account_id')
bucket = setting(r'"binding"\s*:\s*"NEXT_INC_CACHE_R2_BUCKET"\s*,\s*"bucket_name"\s*:\s*"([^"]+)"', 'NEXT_INC_CACHE_R2_BUCKET')
prefix = setting(r'"NEXT_INC_CACHE_R2_PREFIX"\s*:\s*"([^"]+)"', 'NEXT_INC_CACHE_R2_PREFIX')

auth = subprocess.run(['node_modules/.bin/wrangler', 'auth', 'token', '--json'], capture_output=True, text=True)
try:
    token = json.loads(auth.stdout)['token']
except (ValueError, KeyError):
    sys.exit('no Cloudflare credentials: run `pnpm wrangler login` or set CLOUDFLARE_API_TOKEN')


def api(method, path):
    """A Cloudflare API call; waits and tries again when rate limited or the API is busy."""
    for _ in range(6):
        req = urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{bucket}/objects{path}',
                                     method=method, headers={'Authorization': f'Bearer {token}'})
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as error:
            if error.code == 429 or error.code >= 500:
                print(f'  {error.code}, waiting 60 s', flush=True)
                time.sleep(60)
                continue
            return error.code, error.read()
    sys.exit(f'gave up on {method} {path}')


objects, cursor = [], None
while True:
    status, body = api('GET', f'?per_page=1000&prefix={urllib.parse.quote(prefix)}/' + (f'&cursor={cursor}' if cursor else ''))
    if status != 200:
        sys.exit(f'listing failed: HTTP {status} {body[:200]!r}')
    page = json.loads(body)
    objects += page['result']
    cursor = page.get('result_info', {}).get('cursor')
    if not page.get('result_info', {}).get('is_truncated'):
        break

# A build id is 21 characters of A-Z, a-z, 0-9, _ and -.
builds = collections.defaultdict(list)
other = []
for item in objects:
    parts = item['key'].split('/')
    if len(parts) == 3 and re.fullmatch(r'[A-Za-z0-9_-]{21}', parts[1]):
        builds[parts[1]].append(item)
    else:
        other.append(item['key'])

newest = lambda build: max(item['last_modified'] for item in builds[build])
ordered = sorted(builds, key=newest, reverse=True)
keep, drop = ordered[:args.keep], ordered[args.keep:]
doomed = [item for build in drop for item in builds[build]]
mb = lambda items: f'{sum(item["size"] for item in items) / 1e6:.1f} MB'

print(f'{bucket}/{prefix}: {len(objects)} files in {len(builds)} build folders'
      + (f', {len(other)} other files left alone' if other else ''))
print(f'keeping the {len(keep)} newest:')
for build in keep:
    print(f'  {build}  {newest(build)[:16]}  {len(builds[build])} files, {mb(builds[build])}')
print(f'{"deleting" if args.delete else "would delete"} {len(drop)} older folders: {len(doomed)} files, {mb(doomed)}')
if not args.delete or not doomed:
    if doomed:
        print('(nothing deleted; add --delete)')
    sys.exit(0)

failed = []
for done, item in enumerate(doomed, 1):
    status, body = api('DELETE', f'/{urllib.parse.quote(item["key"], safe="")}')
    if status != 200:
        failed.append(f'{item["key"]}: HTTP {status} {body[:200]!r}')
    if done % 250 == 0 or done == len(doomed):
        print(f'{done}/{len(doomed)} done, {len(failed)} failed', flush=True)
    time.sleep(PACE)
for line in failed:
    print('failed:', line)
sys.exit(1 if failed else 0)
