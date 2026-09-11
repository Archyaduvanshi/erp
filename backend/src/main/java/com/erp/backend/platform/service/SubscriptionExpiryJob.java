package com.erp.backend.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SubscriptionExpiryJob {
    private final JdbcTemplate jdbc;

    public SubscriptionExpiryJob(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @org.springframework.transaction.annotation.Transactional
    @Scheduled(cron = "0 10 0 * * *", zone = "Asia/Kolkata")
    public void expireEndedSubscriptions() {
        jdbc.update("""
                with expired as (
                    update institute_subscriptions set status='EXPIRED',updated_at=now(),version=version+1
                    where status in ('TRIAL','ACTIVE','PAST_DUE') and end_date<current_date
                    returning *
                )
                insert into platform_audit_logs(action,target_type,target_id,target_institute_id,new_value_json,reason)
                select 'SUBSCRIPTION_EXPIRED','SUBSCRIPTION',e.id::text,e.institute_id,to_jsonb(e)::text,'Scheduled expiry'
                from expired e
                """);
        jdbc.update("""
                update platform_invoices set status='OVERDUE',updated_at=now(),version=version+1
                where status='PENDING' and due_date<current_date
                """);
    }
}
