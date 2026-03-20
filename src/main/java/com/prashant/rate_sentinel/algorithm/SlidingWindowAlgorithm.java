package com.prashant.rate_sentinel.algorithm;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

@Component
public class SlidingWindowAlgorithm implements RateLimitAlgorithm {

    private final StringRedisTemplate redisTemplate;

    public SlidingWindowAlgorithm(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean isAllowed(String key, long limit, long windowSeconds) {
        long now = Instant.now().toEpochMilli();
        long windowStart = now - (windowSeconds * 1000);
        String redisKey = "sw:" + key;

        // Remove entries outside the window
        redisTemplate.opsForZSet().removeRangeByScore(redisKey, 0, windowStart);

        // Count current entries in window
        Long count = redisTemplate.opsForZSet().zCard(redisKey);
        if (count != null && count >= limit) {
            return false;
        }

        // Add current request timestamp (score = timestamp, member = timestamp:nanoTime for uniqueness)
        String member = now + ":" + System.nanoTime();
        redisTemplate.opsForZSet().add(redisKey, member, now);
        redisTemplate.expire(redisKey, windowSeconds + 1, TimeUnit.SECONDS);

        return true;
    }

    @Override
    public long getRemaining(String key, long limit, long windowSeconds) {
        long now = Instant.now().toEpochMilli();
        long windowStart = now - (windowSeconds * 1000);
        String redisKey = "sw:" + key;

        redisTemplate.opsForZSet().removeRangeByScore(redisKey, 0, windowStart);
        Long count = redisTemplate.opsForZSet().zCard(redisKey);
        long used = count != null ? count : 0;
        return Math.max(0, limit - used);
    }

    @Override
    public String algorithmName() {
        return "SLIDING_WINDOW";
    }
}
