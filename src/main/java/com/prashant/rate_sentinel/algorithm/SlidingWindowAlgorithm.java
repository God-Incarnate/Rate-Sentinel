package com.prashant.rate_sentinel.algorithm;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
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
        // Use a Lua script to perform remove/count/add/expire atomically to avoid race conditions
        String member = now + ":" + System.nanoTime();
        String script = "redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1]); " +
                "local count = redis.call('ZCARD', KEYS[1]); " +
                "if tonumber(count) >= tonumber(ARGV[4]) then return 0; end; " +
                "redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3]); " +
                "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[5])); " +
                "return 1;";

        DefaultRedisScript<Long> redisScript = new DefaultRedisScript<>(script, Long.class);

        Long result = redisTemplate.execute(redisScript,
                Collections.singletonList(redisKey),
                String.valueOf(windowStart), String.valueOf(now), member, String.valueOf(limit), String.valueOf(windowSeconds + 1));

        return result != null && result == 1L;
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
