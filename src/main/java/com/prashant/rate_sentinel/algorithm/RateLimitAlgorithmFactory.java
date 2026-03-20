package com.prashant.rate_sentinel.algorithm;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class RateLimitAlgorithmFactory {

    private final Map<String, RateLimitAlgorithm> algorithmMap;

    public RateLimitAlgorithmFactory(List<RateLimitAlgorithm> algorithms) {
        this.algorithmMap = algorithms.stream()
                .collect(Collectors.toMap(RateLimitAlgorithm::algorithmName, Function.identity()));
    }

    public RateLimitAlgorithm getAlgorithm(String algorithmName) {
        RateLimitAlgorithm algorithm = algorithmMap.get(algorithmName.toUpperCase());
        if (algorithm == null) {
            // Default to sliding window
            return algorithmMap.get("SLIDING_WINDOW");
        }
        return algorithm;
    }
}
