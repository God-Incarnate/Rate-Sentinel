package com.prashant.rate_sentinel.algorithm;

public interface RateLimitAlgorithm {

    boolean isAllowed(String key, long limit, long windowSeconds);

    long getRemaining(String key, long limit, long windowSeconds);

    String algorithmName();
}
