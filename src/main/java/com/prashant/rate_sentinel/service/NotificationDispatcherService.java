package com.prashant.rate_sentinel.service;

import com.prashant.rate_sentinel.model.NotificationEvent;
import com.prashant.rate_sentinel.util.LogConstants;
import com.prashant.rate_sentinel.util.PaymentConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatcherService {
    private final KafkaTemplate<String,Object> kafkaTemplate;

    @Value("${kafka.topics.sms}")
    private String smsTopic;

    @Value("${kafka.topics.email}")
    private String emailTopic;

    @Value("${kafka.topics.whatsapp}")
    private String whatsappTopic;

    @Value("${kafka.topics.payment}")
    private String paymentsTopic;

    public void dispatch(NotificationEvent event){
        String topic=resolveTopic(event);
        try{
            kafkaTemplate.send(topic,event.getEventId(),event);
            log.info(LogConstants.DISPATCHED_EVENT_MSG,
                    event.getEventId(),
                    event.getChannel(),
                    topic,
                    event.getPriority());
        } catch (Exception ex){
            log.error(LogConstants.PAYMENT_MSG_PUBLISH_FAILURE, topic, event.getEventId(), ex);
        }

    }

    public String resolveTopic(NotificationEvent event){
        if (PaymentConstants.SUCCESS_TEMPLATE_ID.equals(event.getTemplateId())
                || PaymentConstants.FAILURE_TEMPLATE_ID.equals(event.getTemplateId())) {
            return paymentsTopic;
        }
        return switch(event.getChannel()){
            case SMS ->smsTopic;
            case EMAIL -> emailTopic;
            case WHATSAPP -> whatsappTopic;
        };
    }
}
