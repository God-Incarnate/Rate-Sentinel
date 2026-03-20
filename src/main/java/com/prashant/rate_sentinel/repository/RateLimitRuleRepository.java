package com.prashant.rate_sentinel.repository;

import com.prashant.rate_sentinel.model.RateLimitRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RateLimitRuleRepository extends JpaRepository<RateLimitRule, Long> {
    Optional<RateLimitRule> findByClientIdAndRouteAndActiveTrue(String clientId, String route);
}
