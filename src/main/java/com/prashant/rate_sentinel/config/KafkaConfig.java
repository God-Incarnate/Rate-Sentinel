package com.prashant.rate_sentinel.config;

import org.apache.kafka.common.serialization.StringSerializer;                  // ✅ FIX
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {
    @Value("${kafka.topics.sms}")
    private String smsTopic;

    @Value("${kafka.topics.email}")
    private String emailTopic;

    @Value("${kafka.topics.whatsapp}")
    private String whatsappTopic;

    @Value("${kafka.topics.payment}")
    private String paymentsTopic;

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> config = new HashMap<>();
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:29092");
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return new DefaultKafkaProducerFactory<>(config);
    }

    @Bean
    public NewTopic smsTopic(){
        return TopicBuilder.name(smsTopic).partitions(3).replicas(1).build();
    }
    @Bean
    public NewTopic emailTopic(){
        return TopicBuilder.name(emailTopic).partitions(3).replicas(1).build();
    }
    @Bean
    public NewTopic whatsappTopic(){
        return TopicBuilder.name(whatsappTopic).partitions(3).replicas(1).build();
    }
    @Bean
    public NewTopic paymentsTopic(){
        return TopicBuilder.name(paymentsTopic).partitions(3).replicas(1).build();
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }
}
