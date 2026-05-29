package com.prashant.rate_sentinel.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "rate_limit_rules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false)
    private String clientId;

    @NotBlank
    @Column(nullable = false)
    private String route;

    @NotNull
    @Column(nullable = false)
    private Long requestLimit;

    @NotNull
    @Column(nullable = false)
    private Long windowSeconds;

    @Column(nullable = false)
    @Builder.Default
    private String algorithm = "SLIDING_WINDOW";

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
