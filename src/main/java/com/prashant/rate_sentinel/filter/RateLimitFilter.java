package com.prashant.rate_sentinel.filter;

import com.prashant.rate_sentinel.model.RateLimitResult;
import com.prashant.rate_sentinel.service.RateLimitService;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import io.micrometer.core.instrument.Counter;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Map;

@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;
    private final Counter throttledCounter;
    private final Counter allowedCounter;

    public RateLimitFilter(RateLimitService rateLimitService,
                           ObjectMapper objectMapper,
                           MeterRegistry meterRegistry) {
        this.rateLimitService = rateLimitService;
        this.objectMapper = objectMapper;
        this.throttledCounter = meterRegistry.counter("rate_limit.throttled");
        this.allowedCounter = meterRegistry.counter("rate_limit.allowed");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String clientId = extractClientId(request);
        String route = request.getRequestURI();

        // Skip actuator and auth endpoints
        if (shouldSkip(route)) {
            filterChain.doFilter(request, response);
            return;
        }

        RateLimitResult result = rateLimitService.checkRateLimit(clientId, route);

        // Always set rate limit headers
        response.setHeader("X-RateLimit-Limit", String.valueOf(result.getLimit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(result.getRemaining()));
        response.setHeader("X-RateLimit-Algorithm", result.getAlgorithm());

        if (!result.isAllowed()) {
            throttledCounter.increment();
            log.warn("Rate limit exceeded for clientId={} route={}", clientId, route);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "error", "Rate limit exceeded",
                    "retryAfter", result.getWindowSeconds(),
                    "clientId", clientId
            )));
            return;
        }

        allowedCounter.increment();
        filterChain.doFilter(request, response);
    }

    private String extractClientId(HttpServletRequest request) {
        // Try JWT subject first, then fall back to IP
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            // JWT subject extracted in JwtAuthFilter — stored in request attribute
            Object clientId = request.getAttribute("clientId");
            if (clientId != null) return clientId.toString();
        }
        String ip = request.getHeader("X-Forwarded-For");
        return ip != null ? ip.split(",")[0].trim() : request.getRemoteAddr();
    }

    private boolean shouldSkip(String route) {
        return route.startsWith("/actuator") ||
               route.startsWith("/api/auth") ||
               route.equals("/favicon.ico");
    }
}
