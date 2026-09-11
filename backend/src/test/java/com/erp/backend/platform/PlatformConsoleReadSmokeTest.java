package com.erp.backend.platform;

import com.erp.backend.platform.service.PlatformConsoleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
class PlatformConsoleReadSmokeTest {
    @Autowired
    private PlatformConsoleService service;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void platformReadModelsExecuteAgainstPostgres() {
        assertNotNull(service.overview());
        assertNotNull(service.institutes(0, 25, "", "", "", "", "", "", "", "",
                null, null, null, null, "registeredAt", "desc"));
        assertNotNull(service.plans());
        assertNotNull(service.subscriptionDirectory(0, 25, "", "", ""));
        assertNotNull(service.featureDirectory(0, 25, "", ""));
        assertNotNull(service.usageOverview());
        assertNotNull(service.usageDirectory(0, 25, "", ""));
        assertNotNull(service.gateways(0, 25, "", "", ""));
        assertNotNull(service.invoices(0, 25, null, "", "", null, null));
        assertNotNull(service.audits(0, 25, null, "", null, "", null, null));
    }

    @Test
    @Transactional
    void historicalExpiredSubscriptionDoesNotChangeExpiredInstituteKpi() {
        Long instituteId = jdbc.query("select institute_id from platform_current_subscriptions limit 1",
                rs -> rs.next() ? rs.getLong(1) : null);
        if (instituteId == null) return;
        Long planId = jdbc.queryForObject("select plan_id from platform_current_subscriptions where institute_id=?", Long.class, instituteId);
        long before = service.overview().expiredInstitutes();
        jdbc.update("""
                insert into institute_subscriptions(institute_id,plan_id,status,billing_cycle,start_date,end_date,amount,change_reason)
                values (?,?,'EXPIRED','MONTHLY',current_date-60,current_date-30,0,'KPI regression test')
                """, instituteId, planId);
        org.junit.jupiter.api.Assertions.assertEquals(before, service.overview().expiredInstitutes());
    }
}
