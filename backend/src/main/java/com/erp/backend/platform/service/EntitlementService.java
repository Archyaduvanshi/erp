package com.erp.backend.platform.service;

import com.erp.backend.platform.FeatureCode;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import com.erp.backend.settings.dto.FeatureAccessResponse;

@Service
public class EntitlementService {
    private final JdbcTemplate jdbc;

    public EntitlementService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public boolean hasFeature(Long instituteId, FeatureCode feature) {
        if (instituteId == null || feature == null) return false;
        Boolean allowed = jdbc.queryForObject("""
                select exists(
                    select 1
                    from institutes i
                    join platform_current_subscriptions s on s.institute_id = i.id
                      and s.effective_status in ('TRIAL','ACTIVE') and s.start_date<=current_date
                    where i.id = ? and i.status = 'ACTIVE'
                      and coalesce(
                        (select o.enabled from institute_feature_overrides o
                         where o.institute_id = i.id and o.feature_code = ?),
                        exists(select 1 from subscription_plan_features pf
                               where pf.plan_id = s.plan_id and pf.feature_code = ?)
                      ) = true
                )
                """, Boolean.class, instituteId, feature.name(), feature.name());
        return Boolean.TRUE.equals(allowed);
    }

    public void validateFeature(Long instituteId, FeatureCode feature) {
        if (!hasFeature(instituteId, feature)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This feature is not enabled for the institute subscription.");
        }
    }

    public void validateInstituteAccess(Long instituteId) {
        Boolean allowed = jdbc.queryForObject("""
                select exists(
                  select 1 from institutes i
                  join platform_current_subscriptions s on s.institute_id=i.id
                    and s.effective_status in ('TRIAL','ACTIVE') and s.start_date<=current_date
                  where i.id = ? and i.status = 'ACTIVE'
                )
                """, Boolean.class, instituteId);
        if (!Boolean.TRUE.equals(allowed)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Institute access is suspended or archived.");
        }
    }

    public List<FeatureAccessResponse> effectivePermissions(Long instituteId) {
        Set<String> enabled = new HashSet<>(jdbc.queryForList("""
                select f.code
                from %s f(code)
                join platform_current_subscriptions s on s.institute_id=? and s.effective_status in ('TRIAL','ACTIVE') and s.start_date<=current_date
                left join institute_feature_overrides o on o.institute_id=? and o.feature_code=f.code
                join institutes i on i.id=s.institute_id and i.status='ACTIVE'
                where coalesce(o.enabled, exists(select 1 from subscription_plan_features pf where pf.plan_id=s.plan_id and pf.feature_code=f.code))
                """.formatted(FeatureCode.sqlValues()), String.class, instituteId, instituteId));
        return FeatureCode.registry().stream()
                .map(feature -> new FeatureAccessResponse(feature.legacyKey(), null, null, null, "read_write",
                        enabled.contains(feature.code()), false, null))
                .toList();
    }
    public java.util.Map<String,Object> getCurrentSubscription(Long instituteId) {
        return jdbc.query("select id,plan_id,effective_status,start_date,end_date from platform_current_subscriptions where institute_id=?",
                rs -> rs.next() ? java.util.Map.of("id",rs.getLong(1),"planId",rs.getLong(2),"status",rs.getString(3),"startDate",rs.getDate(4).toLocalDate(),"endDate",rs.getDate(5).toLocalDate()) : null,instituteId);
    }

    public void validateSubscription(Long instituteId) { validateInstituteAccess(instituteId); }

    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void validatePlanLimits(Long instituteId,PlanLimitService.Resource resource,int requested) {
        if(requested<=0) return;
        jdbc.queryForList("select id from institutes where id=? for update",Long.class,instituteId);
        validateSubscription(instituteId);
        String column=switch(resource){case STUDENTS->"max_students";case TEACHERS->"max_teachers";case USERS->"max_users";};
        Integer limit=jdbc.query("select p."+column+" from platform_current_subscriptions s join subscription_plans p on p.id=s.plan_id where s.institute_id=? for share of p",
                rs->rs.next()?(Integer)rs.getObject(1):null,instituteId);
        if(limit==null) return;
        String table=switch(resource){case STUDENTS->"students";case TEACHERS->"teachers";case USERS->"user_accounts";};
        String active=resource==PlanLimitService.Resource.USERS?"status='ACTIVE'":"lower(coalesce(status,'active'))<>'archived'";
        Long used=jdbc.queryForObject("select count(*) from "+table+" where institute_id=? and "+active,Long.class,instituteId);
        if(used+requested>limit){
            String code=switch(resource){case STUDENTS->"PLAN_STUDENT_LIMIT_REACHED";case TEACHERS->"PLAN_TEACHER_LIMIT_REACHED";case USERS->"PLAN_USER_LIMIT_REACHED";};
            throw new IllegalArgumentException(code+": Current usage "+used+" of "+limit+"; requested "+requested+".");
        }
    }

}
