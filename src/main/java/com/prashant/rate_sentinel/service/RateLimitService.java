package com.prashant.rate_sentinel.service;


import com.prashant.rate_sentinel.algorithm.RateLimitAlgorithm;
import com.prashant.rate_sentinel.algorithm.RateLimitAlgorithmFactory;
import com.prashant.rate_sentinel.model.RateLimitResult;
import com.prashant.rate_sentinel.model.RateLimitRule;
import com.prashant.rate_sentinel.repository.RateLimitRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final RateLimitAlgorithmFactory algorithmFactory;
    private final RateLimitRuleRepository ruleRepository;

    @Value("${rate-limiter.default-limit}")
    private long defaultLimit;

    @Value("${rate-limiter.default-window-seconds}")
    private long defaultWindowSeconds;

    @Value("${rate-limiter.algorithm}")
    private String defaultAlgorithm;

    public RateLimitResult checkRateLimit(String clientId, String route) {
        RateLimitRule rule = getRule(clientId, route);

        String key = clientId + ":" + route;
        RateLimitAlgorithm algorithm = algorithmFactory.getAlgorithm(rule.getAlgorithm());

        boolean allowed = algorithm.isAllowed(key, rule.getRequestLimit(), rule.getWindowSeconds());
        long remaining = algorithm.getRemaining(key, rule.getRequestLimit(), rule.getWindowSeconds());

        return RateLimitResult.builder()
                .allowed(allowed)
                .remaining(remaining)
                .limit(rule.getRequestLimit())
                .windowSeconds(rule.getWindowSeconds())
                .algorithm(rule.getAlgorithm())
                .key(key)
                .build();
    }

    @Cacheable(value = "rate-limit-rules", key = "#clientId + ':' + #route")
    public RateLimitRule getRule(String clientId, String route) {
        // Try exact match first, then wildcard client, then global default
        return ruleRepository.findByClientIdAndRouteAndActiveTrue(clientId, route)
                .or(() -> ruleRepository.findByClientIdAndRouteAndActiveTrue("*", route))
                .or(() -> ruleRepository.findByClientIdAndRouteAndActiveTrue("*", "*"))
                .orElseGet(this::defaultRule);
    }

    private RateLimitRule defaultRule() {
        return RateLimitRule.builder()
                .clientId("*")
                .route("*")
                .requestLimit(defaultLimit)
                .windowSeconds(defaultWindowSeconds)
                .algorithm(defaultAlgorithm)
                .build();
    }
}
