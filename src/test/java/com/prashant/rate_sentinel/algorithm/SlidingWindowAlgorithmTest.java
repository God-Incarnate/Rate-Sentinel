package com.prashant.rate_sentinel.algorithm;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test for SlidingWindowAlgorithm atomicity.
 * Verifies that under high concurrency, the atomic Lua script prevents overshoot.
 */
@SpringBootTest
public class SlidingWindowAlgorithmTest {

    @Autowired
    private SlidingWindowAlgorithm slidingWindowAlgorithm;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private static final String TEST_KEY = "test-concurrent-limit";
    private static final long LIMIT = 5;
    private static final long WINDOW_SECONDS = 60;

    @BeforeEach
    public void setUp() {
        // Clean up Redis before each test
        redisTemplate.delete("sw:" + TEST_KEY);
    }

    @Test
    public void testBasicSlidingWindow() {
        // Test that first 5 requests are allowed, 6th is rejected
        for (int i = 1; i <= 5; i++) {
            assertTrue(slidingWindowAlgorithm.isAllowed(TEST_KEY, LIMIT, WINDOW_SECONDS),
                    "Request " + i + " should be allowed");
        }
        
        // 6th request should be rejected
        assertFalse(slidingWindowAlgorithm.isAllowed(TEST_KEY, LIMIT, WINDOW_SECONDS),
                "Request 6 should be rejected (limit exceeded)");
        
        // remaining should be 0
        long remaining = slidingWindowAlgorithm.getRemaining(TEST_KEY, LIMIT, WINDOW_SECONDS);
        assertEquals(0, remaining, "Remaining should be 0 after limit exhausted");
    }

    @Test
    public void testConcurrentRequests() throws InterruptedException {
        // Simulate 20 concurrent requests with limit of 5
        int numThreads = 20;
        int limit = 5;
        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch endSignal = new CountDownLatch(numThreads);
        AtomicInteger allowedCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);

        // Spawn 20 threads that all try to check limit at roughly the same time
        for (int i = 0; i < numThreads; i++) {
            new Thread(() -> {
                try {
                    // All threads wait at the start line to maximize concurrency
                    startSignal.await();
                    
                    if (slidingWindowAlgorithm.isAllowed(TEST_KEY, limit, WINDOW_SECONDS)) {
                        allowedCount.incrementAndGet();
                    } else {
                        rejectedCount.incrementAndGet();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                endSignal.countDown();
            }).start();
        }

        // Release all threads at once
        startSignal.countDown();
        
        // Wait for all threads to complete
        endSignal.await();

        // With atomic Lua script: exactly 'limit' requests should be allowed, rest rejected
        assertEquals(limit, allowedCount.get(),
                "Expected exactly " + limit + " allowed requests, but got " + allowedCount.get());
        assertEquals(numThreads - limit, rejectedCount.get(),
                "Expected " + (numThreads - limit) + " rejected requests, but got " + rejectedCount.get());
    }

    @Test
    public void testRemainingCounter() {
        // Use 2 requests, verify remaining decreases correctly
        slidingWindowAlgorithm.isAllowed(TEST_KEY, LIMIT, WINDOW_SECONDS);
        long remaining1 = slidingWindowAlgorithm.getRemaining(TEST_KEY, LIMIT, WINDOW_SECONDS);
        assertEquals(4, remaining1, "After 1 request, remaining should be 4");

        slidingWindowAlgorithm.isAllowed(TEST_KEY, LIMIT, WINDOW_SECONDS);
        long remaining2 = slidingWindowAlgorithm.getRemaining(TEST_KEY, LIMIT, WINDOW_SECONDS);
        assertEquals(3, remaining2, "After 2 requests, remaining should be 3");

        // Use up remaining 3
        for (int i = 0; i < 3; i++) {
            slidingWindowAlgorithm.isAllowed(TEST_KEY, LIMIT, WINDOW_SECONDS);
        }
        long remaining5 = slidingWindowAlgorithm.getRemaining(TEST_KEY, LIMIT, WINDOW_SECONDS);
        assertEquals(0, remaining5, "After 5 requests, remaining should be 0");
    }
}

