# Rate Limit Rule Fix - Complete Solution

## Problem Summary
Your DB rule:
```
id=1, algorithm=SLIDING_WINDOW, clientId=otp-service, route=/api/v1/otp/generate-otp, requestLimit=5, windowSeconds=60
```

**Why it didn't work:** Requests came with a different `clientId` (likely an IP or different JWT subject) so the rule didn't match. The server evaluates rule lookup as: `requestClientId + requestRoute` must match rule's `clientId + route`.

## Root Cause
1. **clientId mismatch** (main issue)
   - Rule stored: `clientId = "otp-service"`
   - Request came with: `clientId = IP_ADDRESS` (because no Authorization JWT was sent, or JWT subject ≠ "otp-service")
   - Result: Rule lookup fails, request uses default/global rule instead

2. **Concurrent race in sliding window** (now fixed)
   - Previous implementation did separate Redis calls that could race under high concurrency
   - Now uses atomic Redis Lua script (single operation)

## Solution

### Step 1: Change Rule to Wildcard Client (applies to all)
**Option A: Via SQL** (if you have DB access)
```sql
UPDATE rate_limit_rules
SET client_id = '*'
WHERE id = 1;
```

**Option B: Via Admin API** (replace ADMIN_JWT with your token)
```powershell
curl -X PUT http://localhost:8080/api/admin/rules/1 `
  -H "Authorization: Bearer <ADMIN_JWT>" `
  -H "Content-Type: application/json" `
  -d '{"clientId":"*","route":"/api/v1/otp/generate-otp","requestLimit":5,"windowSeconds":60,"algorithm":"SLIDING_WINDOW","active":true}'
```

### Step 2: Deploy Updated Code
The code is already built and ready:
```powershell
# JAR is ready at: target\rate-sentinel-0.0.1-SNAPSHOT.jar
# Changes include:
# - Debug logging in RateLimitFilter (helps diagnose client identity)
# - Atomic Lua script in SlidingWindowAlgorithm (prevents concurrent overshoot)
```

Deploy the jar and restart the app:
```powershell
java -jar target\rate-sentinel-0.0.1-SNAPSHOT.jar
```

### Step 3: Test the Fix

**Trigger 6 requests quickly (should get 429 on 6th):**
```powershell
for ($i=1; $i -le 6; $i++) {
  Write-Host "Request $i"
  curl -i -X POST http://localhost:8080/api/v1/otp/generate-otp `
    -H "Content-Type: application/json" `
    -d '{"phone":"+1234567890"}'
  Write-Host "`n---`n"
  Start-Sleep -Milliseconds 200
}
```

**Expected output:**
- Requests 1-5: HTTP 200 or 201 (allowed)
- Request 6: HTTP 429 Too Many Requests with `{ "error": "Rate limit exceeded", ... }`
- Response headers on each request: `X-RateLimit-Limit: 5`, `X-RateLimit-Remaining: ...`

**Test concurrent requests (verify atomic Lua prevents overshoot):**
```powershell
# Fire 10 requests in parallel (all roughly at same time)
1..10 | ForEach-Object {
  Start-Job {
    curl -X POST http://localhost:8080/api/v1/otp/generate-otp `
      -H "Content-Type: application/json" `
      -d '{"phone":"+1234567890"}'
  }
}
Get-Job | Receive-Job
```
- With atomic Lua fix: exactly 5 should succeed, 5 should get 429.
- Without atomic fix: more than 5 might succeed due to race conditions.

## Code Changes Made

### 1. RateLimitFilter - Added Debug Logging
**File:** `src/main/java/com/prashant/rate_sentinel/filter/RateLimitFilter.java`

Debug logs show:
- `RateLimitFilter - incoming request clientId=... route=... method=...`
- `RateLimitFilter - evaluated result allowed=... limit=... remaining=... algo=... key=... windowSeconds=...`

**How to enable:** Run with debug logging
```powershell
java -jar target\rate-sentinel-0.0.1-SNAPSHOT.jar --logging.level.com.prashant.rate_sentinel.filter=DEBUG
```

### 2. SlidingWindowAlgorithm - Atomic Lua Script
**File:** `src/main/java/com/prashant/rate_sentinel/algorithm/SlidingWindowAlgorithm.java`

**What changed:**
- Old: 4 separate Redis operations → possible race conditions
- New: 1 atomic Lua script that:
  1. Removes old entries outside window
  2. Counts remaining entries
  3. Returns 0 (rejected) if count ≥ limit, else adds member and returns 1 (allowed)
  4. Sets expiry
  - All in ONE atomic transaction → no overshoot under concurrency

## Why This Fixes Your Issue

1. **Changing `clientId` to `'*'`**
   - Rule now matches ANY request to `/api/v1/otp/generate-otp`
   - No longer depends on JWT subject matching `"otp-service"`
   - Your 10 requests will now be limited to 5 per 60s

2. **Atomic Lua script**
   - Prevents concurrent requests from all reading count=0 and then incrementing → count=10
   - Strict enforcement even under high concurrency
   - Each request atomically checks and increments in a single Redis operation

## Verification Checklist
- [ ] Update DB rule to `clientId = '*'` (SQL or API)
- [ ] Restart app with new jar (`target\rate-sentinel-0.0.1-SNAPSHOT.jar`)
- [ ] Run test: 6 sequential requests → 6th should be 429
- [ ] Check response headers: `X-RateLimit-Limit: 5`, `X-RateLimit-Remaining` decrementing
- [ ] (Optional) Run concurrent test: 10 parallel requests → exactly 5 allowed, 5 rejected
- [ ] (Optional) Enable debug logging and inspect client identity if needed

## Alternative: If You Want to Keep clientId Specific
If you want the rule to apply ONLY to service identity `"otp-service"`, ensure:
- All requests from your OTP service include JWT with subject = `"otp-service"`
- The JWT is placed in Authorization Bearer header

Then the rule with `clientId="otp-service"` will match.

## Questions?
- If requests are still not being limited after changing `clientId='*'`: check Redis is running and accessible
- If you see `allowed=true` even after 5 requests: enable DEBUG logging and paste the filter logs here
- If you want to exclude admin endpoints from rate limiting, let me know and I can update `shouldSkip()` in RateLimitFilter

