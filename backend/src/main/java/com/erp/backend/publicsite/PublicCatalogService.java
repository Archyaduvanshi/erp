package com.erp.backend.publicsite;

import com.erp.backend.platform.FeatureCode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class PublicCatalogService {
    private final JdbcTemplate jdbc;
    public PublicCatalogService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Explicit public feature allowlist. Unreleased or unknown codes never reach the public API.
    static String publicFeature(String code) {
        try {
            FeatureCode feature = FeatureCode.valueOf(code);
            return feature == FeatureCode.LIVE_TRANSPORT_TRACKING ? null : feature.label();
        } catch (IllegalArgumentException | NullPointerException ignored) { return null; }
    }

    @Transactional(readOnly=true)
    public List<PublicDtos.Plan> plans() {
        Map<String, List<String>> features = new HashMap<>();
        jdbc.query("""
                select p.code, f.feature_code from subscription_plan_features f
                join subscription_plans p on p.id=f.plan_id where p.status='ACTIVE'
                order by f.feature_code
                """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            String label = publicFeature(rs.getString(2));
            if (label != null) features.computeIfAbsent(rs.getString(1), ignored -> new ArrayList<>()).add(label);
        });
        return jdbc.query("""
                select name,code,monthly_price,yearly_price,trial_days,max_students,max_teachers
                from subscription_plans where status='ACTIVE' order by monthly_price,yearly_price,code
                """, (rs, n) -> new PublicDtos.Plan(rs.getString(1), rs.getString(2), rs.getBigDecimal(3),
                rs.getBigDecimal(4), rs.getInt(5), rs.getObject(6, Integer.class), rs.getObject(7, Integer.class),
                List.copyOf(features.getOrDefault(rs.getString(2), List.of()))));
    }

    public PublicDtos.Config config() {
        Map<String,String> settings = new HashMap<>();
        jdbc.query("""
                select setting_key,setting_value from platform_settings
                where setting_key in ('platformSupportEmail','platformSupportPhone','registrationEnabled')
                """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> settings.put(rs.getString(1), rs.getString(2)));
        String email = settings.getOrDefault("platformSupportEmail", "").trim();
        String phone = settings.getOrDefault("platformSupportPhone", "").trim();
        if (!email.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+")) email = "";
        if (!phone.matches("[+0-9() .\\-]{7,24}")) phone = "";
        return new PublicDtos.Config(email, phone, Boolean.parseBoolean(settings.get("registrationEnabled")));
    }
}
