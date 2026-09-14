package com.erp.backend.publicsite;

import com.erp.backend.auth.OtpEmailDeliveryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DemoNotificationJob {
    private static final Logger log=LoggerFactory.getLogger(DemoNotificationJob.class);
    private final JdbcTemplate jdbc;
    private final PublicCatalogService catalog;
    private final OtpEmailDeliveryService email;
    public DemoNotificationJob(JdbcTemplate jdbc, PublicCatalogService catalog, OtpEmailDeliveryService email) {
        this.jdbc=jdbc; this.catalog=catalog; this.email=email;
    }

    @Scheduled(fixedDelayString="${app.public.demo-notification-delay-ms:60000}")
    @Transactional
    public void deliverNext() {
        jdbc.update("delete from public_request_limits where expires_at<now()");
        String recipient=catalog.config().supportEmail();
        if (recipient.isBlank()) return; // Keep durable requests pending until support is configured.
        var rows=jdbc.queryForList("""
                select id,name,institute_name,email,phone,institute_type,city,approximate_students,message
                from public_demo_requests where notification_status='PENDING' and next_notification_at<=now()
                order by created_at limit 1 for update skip locked
                """);
        if (rows.isEmpty()) return;
        var row=rows.get(0);
        Long id=((Number)row.get("id")).longValue();
        String body="Demo request #"+id+"\n\nName: "+row.get("name")+"\nInstitution: "+row.get("institute_name")
                +"\nEmail: "+row.get("email")+"\nPhone: "+row.get("phone")+"\nType: "+row.get("institute_type")
                +"\nCity: "+row.get("city")+"\nApproximate students: "+row.get("approximate_students")
                +"\n\nMessage:\n"+row.get("message");
        try {
            // Only the configured support mailbox receives plain text; never mail public-supplied recipients.
            email.send(recipient,"VidyantraErp demo request #"+id,body);
            jdbc.update("update public_demo_requests set notification_status='SENT',notification_attempts=notification_attempts+1 where id=?",id);
            log.info("Demo request {} support notification sent",id);
        } catch (RuntimeException failure) {
            jdbc.update("""
                    update public_demo_requests set notification_attempts=notification_attempts+1,
                    notification_status=case when notification_attempts>=4 then 'FAILED' else 'PENDING' end,
                    next_notification_at=now()+interval '15 minutes' where id=?
                    """,id);
            log.warn("Demo request {} support notification failed; request retained",id);
        }
    }
}
