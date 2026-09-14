package com.erp.backend.publicsite;

import java.time.Duration;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class DemoRequestService {
    private static final Logger log=LoggerFactory.getLogger(DemoRequestService.class);
    private final JdbcTemplate jdbc;
    private final PublicRateLimitService limiter;
    public DemoRequestService(JdbcTemplate jdbc, PublicRateLimitService limiter) { this.jdbc=jdbc; this.limiter=limiter; }

    @Transactional
    public void submit(PublicDtos.DemoRequest request) {
        // Honeypot submissions appear accepted without persisting or sending mail.
        if (request.website()!=null && !request.website().isBlank()) return;
        long elapsed = System.currentTimeMillis()-request.startedAt();
        if (elapsed < 2000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please review the form and try again.");
        String email=plain(request.email()).toLowerCase(Locale.ROOT);
        limiter.check("demo-email", email, 3, Duration.ofDays(1));
        String digits=request.phone().replaceAll("\\D", "");
        if (digits.length()<7 || digits.length()>15) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone must contain 7–15 digits.");
        Long id=jdbc.queryForObject("""
                insert into public_demo_requests(name,institute_name,email,phone,institute_type,city,approximate_students,message)
                values (?,?,?,?,?,?,?,?) returning id
                """, Long.class, plain(request.name()), plain(request.instituteName()), email, plain(request.phone()),
                request.instituteType(), plain(request.city()), request.approximateStudents(), plain(request.message()));
        log.info("Public demo request {} received; support notification queued", id);
    }

    static String plain(String value) {
        if (value==null) return "";
        if (value.indexOf('<')>=0 || value.indexOf('>')>=0 || value.chars().anyMatch(c -> Character.isISOControl(c) && c!='\n' && c!='\r' && c!='\t'))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use plain text only; HTML is not accepted.");
        return value.trim();
    }
}
