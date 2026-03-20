package com.prashant.rate_sentinel.algorithm;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class FixedWindowAlgorithm implements RateLimitAlgorithm {

    private final StringRedisTemplate redisTemplate;

    public FixedWindowAlgorithm(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean isAllowed(String key, long limit, long windowSeconds) {
        String redisKey = "fw:" + key + ":" + (System.currentTimeMillis() / (windowSeconds * 1000));

        Long count = redisTemplate.opsForValue().increment(redisKey);
        if (count == 1) {
            redisTemplate.expire(redisKey, windowSeconds, TimeUnit.SECONDS);
        }
        return count <= limit;
    }

    @Override
    public long getRemaining(String key, long limit, long windowSeconds) {
        String redisKey = "fw:" + key + ":" + (System.currentTimeMillis() / (windowSeconds * 1000));
        String val = redisTemplate.opsForValue().get(redisKey);
        long used = val != null ? Long.parseLong(val) : 0;
        return Math.max(0, limit - used);
    }

    @Override
    public String algorithmName() {
        return "FIXED_WINDOW";
    }
}
