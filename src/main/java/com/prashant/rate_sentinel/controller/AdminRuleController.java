package com.prashant.rate_sentinel.controller;


import com.prashant.rate_sentinel.model.RateLimitRule;
import com.prashant.rate_sentinel.repository.RateLimitRuleRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/rules")
@RequiredArgsConstructor
public class AdminRuleController {

    private final RateLimitRuleRepository ruleRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<RateLimitRule> getAllRules() {
        return ruleRepository.findAll();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @CacheEvict(value = "rate-limit-rules", allEntries = true)
    public ResponseEntity<RateLimitRule> createRule(@Valid @RequestBody RateLimitRule rule) {
        normalizeRuleRoute(rule);
        return ResponseEntity.ok(ruleRepository.save(rule));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @CacheEvict(value = "rate-limit-rules", allEntries = true)
    public ResponseEntity<RateLimitRule> updateRule(@PathVariable Long id,
                                                     @Valid @RequestBody RateLimitRule rule) {
        rule.setId(id);
        normalizeRuleRoute(rule);
        return ResponseEntity.ok(ruleRepository.save(rule));
    }

    // ensure route is stored in normalized form (leading slash) so matching works with request.getRequestURI()
    private void normalizeRuleRoute(RateLimitRule rule) {
        String r = rule.getRoute();
        if (r == null) return;
        r = r.trim();
        if (!r.startsWith("/")) r = "/" + r;
        rule.setRoute(r);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @CacheEvict(value = "rate-limit-rules", allEntries = true)
    public ResponseEntity<Void> deleteRule(@PathVariable Long id) {
        ruleRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
