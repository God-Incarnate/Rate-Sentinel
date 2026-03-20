package com.prashant.rate_sentinel.model;

import lombok.*;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RateLimitResult {
    private boolean allowed;
    private long remaining;
    private long limit;
    private long windowSeconds;
    private String algorithm;
    private String key;
}
