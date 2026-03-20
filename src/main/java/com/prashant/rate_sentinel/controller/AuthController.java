package com.prashant.rate_sentinel.controller;

import com.prashant.rate_sentinel.security.JWTTokenProvider;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JWTTokenProvider jwtTokenProvider;

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(
            @RequestParam @NotBlank String username,
            @RequestParam @NotBlank String password) {

        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password));

        String role = auth.getAuthorities().iterator().next().getAuthority();
        String token = jwtTokenProvider.generateToken(username, role);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "type", "Bearer",
                "username", username
        ));
    }
}
