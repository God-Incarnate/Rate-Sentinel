package com.prashant.rate_sentinel.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RateLimitResult {
    private boolean allowed;
    private long remaining;
    private long limit;
    private long windowSeconds;
    private String algorithm;
    private String key;
}
