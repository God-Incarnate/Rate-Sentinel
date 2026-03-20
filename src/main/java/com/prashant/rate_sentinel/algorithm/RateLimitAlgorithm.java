package com.prashant.rate_sentinel.algorithm;

public interface RateLimitAlgorithm {

    /**
     * Attempt to consume a token for the given key.
     * @param key     unique identifier (clientId:route)
     * @param limit   max requests allowed in the window
     * @param windowSeconds time window in seconds
     * @return true if request is allowed, false if throttled
     */
    boolean isAllowed(String key, long limit, long windowSeconds);

    /**
     * Returns remaining tokens/requests for the key.
     */
    long getRemaining(String key, long limit, long windowSeconds);

    String algorithmName();
}
