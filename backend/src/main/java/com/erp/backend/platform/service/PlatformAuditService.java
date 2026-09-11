package com.erp.backend.platform.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PlatformAuditService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public PlatformAuditService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        var dates = new com.fasterxml.jackson.databind.module.SimpleModule();
        dates.addSerializer(java.time.LocalDate.class, com.fasterxml.jackson.databind.ser.std.ToStringSerializer.instance);
        dates.addSerializer(java.time.LocalDateTime.class, com.fasterxml.jackson.databind.ser.std.ToStringSerializer.instance);
        this.objectMapper = objectMapper.copy().registerModule(dates);
    }

    public void record(Long actorId, String action, String targetType, String targetId, Long instituteId,
                       Object oldValue, Object newValue, String reason, String ipAddress, String userAgent) {
        jdbc.update("""
                insert into platform_audit_logs(platform_user_id, action, target_type, target_id,
                    target_institute_id, old_value_json, new_value_json, reason, ip_address, user_agent)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, actorId, action, targetType, targetId, instituteId, json(oldValue), json(newValue),
                clean(reason, 500), clean(ipAddress, 80), clean(userAgent, 500));
    }

    private String json(Object value) {
        if (value == null) return null;
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException("Unable to serialize audit value.", exception); }
    }

    private String clean(String value, int limit) {
        if (value == null) return null;
        String clean = value.trim();
        return clean.length() <= limit ? clean : clean.substring(0, limit);
    }
}
