package com.prashant.rate_sentinel.algorithm;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

@Component
public class TokenBucketAlgorithm implements RateLimitAlgorithm {

    private static final String TOKENS_KEY = "tb:tokens:";
    private static final String LAST_REFILL_KEY = "tb:refill:";

    private final StringRedisTemplate redisTemplate;

    public TokenBucketAlgorithm(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean isAllowed(String key, long limit, long windowSeconds) {
        long now = Instant.now().getEpochSecond();
        String tokensKey = TOKENS_KEY + key;
        String refillKey = LAST_REFILL_KEY + key;

        String lastRefillStr = redisTemplate.opsForValue().get(refillKey);
        String tokensStr = redisTemplate.opsForValue().get(tokensKey);

        long lastRefill = lastRefillStr != null ? Long.parseLong(lastRefillStr) : now;
        long tokens = tokensStr != null ? Long.parseLong(tokensStr) : limit;

        // Refill tokens based on elapsed time
        long elapsed = now - lastRefill;
        double refillRate = (double) limit / windowSeconds;
        long newTokens = Math.min(limit, tokens + (long)(elapsed * refillRate));

        if (newTokens <= 0) {
            return false;
        }

        // Consume one token
        redisTemplate.opsForValue().set(tokensKey, String.valueOf(newTokens - 1), windowSeconds + 1, TimeUnit.SECONDS);
        redisTemplate.opsForValue().set(refillKey, String.valueOf(now), windowSeconds + 1, TimeUnit.SECONDS);
        return true;
    }

    @Override
    public long getRemaining(String key, long limit, long windowSeconds) {
        String tokensStr = redisTemplate.opsForValue().get(TOKENS_KEY + key);
        return tokensStr != null ? Long.parseLong(tokensStr) : limit;
    }

    @Override
    public String algorithmName() {
        return "TOKEN_BUCKET";
    }
}
