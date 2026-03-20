package com.prashant.rate_sentinel.model;

import com.prashant.rate_sentinel.enums.NotificationChannel;
import com.prashant.rate_sentinel.enums.NotificationPriority;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class NotificationEvent {

    private String eventId;                   //UUID
    private String clientId;                  //username
    private String recipient;                 //Mo.No. or EmailId
    private String templateId;                //templateId
    private NotificationChannel channel;      //SMS,EMAIL,WHATSAPP
    private Map<String,String> templateParams;//template-wise params
    private String correlationId;             //paymentId,otpId etc.
    private NotificationPriority priority;
    @Builder.Default
    private LocalDateTime createdAt=LocalDateTime.now();

}
