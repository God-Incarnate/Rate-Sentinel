package com.prashant.rate_sentinel.controller;

import com.prashant.rate_sentinel.enums.NotificationChannel;
import com.prashant.rate_sentinel.service.OTPService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/otp")
@RequiredArgsConstructor
public class OTPController {
    private final OTPService otpService;

    @PostMapping("/generate-otp")
    public ResponseEntity<Map<String,String>> generateOTP(
            @RequestParam @NotBlank String identifier,
            @RequestParam NotificationChannel otpType
            ){

        String result=otpService.generatesOTP(identifier,otpType);

        return ResponseEntity.ok(Map.of("Message",result));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<Map<String,Boolean>> verifyOTP(
            @RequestParam @NotBlank String identifier,
            @RequestParam String otp,
            @RequestParam NotificationChannel otpType
    ) {
        boolean verified=otpService.verifiesOTP(identifier,otp,otpType);
        return ResponseEntity.ok(Map.of("Verified",verified));
    }
}
