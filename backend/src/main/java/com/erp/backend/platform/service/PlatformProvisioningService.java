package com.erp.backend.platform.service;

import java.time.LocalDate;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PlatformProvisioningService {
    private final JdbcTemplate jdbc;

    public PlatformProvisioningService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void assertRegistrationEnabled() {
        String value = jdbc.queryForObject("select setting_value from platform_settings where setting_key = 'registrationEnabled'", String.class);
        if (!Boolean.parseBoolean(value)) throw new IllegalStateException("New institute registration is temporarily disabled.");
    }

    @org.springframework.transaction.annotation.Transactional
    public void provisionTrial(Long instituteId) {
        String defaultPlan=jdbc.query("select setting_value from platform_settings where setting_key='defaultPlan' for share",rs->rs.next()?rs.getString(1):null);
        if(defaultPlan==null || defaultPlan.isBlank()) throw new IllegalStateException("DEFAULT_PLAN_NOT_CONFIGURED");
        Integer planTrial=jdbc.query("select trial_days from subscription_plans where code=? and status='ACTIVE' for share",rs->rs.next()?rs.getInt(1):null,defaultPlan.trim().toUpperCase(java.util.Locale.ROOT));
        if(planTrial==null) throw new IllegalStateException("DEFAULT_PLAN_NOT_CONFIGURED");
        int trialDays=Integer.parseInt(setting("defaultTrialDays",String.valueOf(planTrial)));
        if(trialDays<0 || trialDays>365) throw new IllegalStateException("INVALID_TRIAL_DAYS");
        Long id=jdbc.queryForObject("""
                insert into institute_subscriptions(institute_id,plan_id,status,billing_cycle,start_date,end_date,amount,change_reason)
                select ?,p.id,'TRIAL','CUSTOM',?,?,0,'Automatic registration trial'
                from subscription_plans p where p.code=? and p.status='ACTIVE' returning id
                """,Long.class,instituteId,LocalDate.now(),LocalDate.now().plusDays(trialDays),defaultPlan.trim().toUpperCase(java.util.Locale.ROOT));
        jdbc.update("""
                insert into platform_audit_logs(action,target_type,target_id,target_institute_id,new_value_json,reason)
                select 'SUBSCRIPTION_ASSIGNED','SUBSCRIPTION',id::text,institute_id,to_jsonb(s)::text,'Automatic registration trial'
                from institute_subscriptions s where id=?
                """,id);
    }

    private String setting(String key, String fallback) {
        return jdbc.query("select setting_value from platform_settings where setting_key = ?", rs -> rs.next() ? rs.getString(1) : fallback, key);
    }
}
