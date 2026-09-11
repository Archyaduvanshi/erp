package com.erp.backend.platform.service;

import static com.erp.backend.platform.dto.PlatformDtos.*;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Objects;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.platform.FeatureCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class PlatformConsoleService {
    private static final Set<Integer> PAGE_SIZES = Set.of(25, 50, 100);
    private static final Map<String, String> INSTITUTE_SORTS = Map.of(
            "registeredAt", "i.registered_date", "instituteName", "i.institute_name",
            "studentCount", "student_count", "subscriptionExpiry", "subscription_expiry"
    );
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate namedJdbc;
    private final PlatformAuditService audit;

    public PlatformConsoleService(JdbcTemplate jdbc, NamedParameterJdbcTemplate namedJdbc, PlatformAuditService audit) {
        this.jdbc = jdbc;
        this.namedJdbc = namedJdbc;
        this.audit = audit;
    }

    public Overview overview() {
        Map<String, Object> row = jdbc.queryForMap("""
                select
                  (select count(*) from institutes) total_institutes,
                  (select count(*) from institutes where status = 'ACTIVE') active_institutes,
                  (select count(*) from platform_current_subscriptions where effective_status = 'TRIAL') trial_institutes,
                  (select count(*) from institutes where status = 'SUSPENDED') suspended_institutes,
                  (select count(*) from platform_current_subscriptions where effective_status = 'EXPIRED') expired_institutes,
                  (select count(*) from students where lower(coalesce(status,'active')) <> 'archived') total_students,
                  (select count(*) from teachers where lower(coalesce(status,'active')) <> 'archived') total_teachers,
                  (select count(*) from platform_current_subscriptions where effective_status = 'ACTIVE') active_subscriptions,
                  (select count(*) from platform_current_subscriptions where effective_status in ('TRIAL','ACTIVE') and end_date between current_date and current_date + 7) expiring_7,
                  (select count(*) from platform_current_subscriptions where effective_status in ('TRIAL','ACTIVE') and end_date between current_date and current_date + 30) expiring_30,
                  (select count(distinct institute_id) from institute_payment_gateway_accounts where payments_enabled = true) gateway_enabled,
                  (select coalesce(sum(total_amount),0) from platform_invoices where status='PAID' and paid_at >= date_trunc('month', current_date)) monthly_revenue,
                  (select coalesce(sum(total_amount),0) from platform_invoices where status='PAID' and paid_at >= date_trunc('year', current_date)) yearly_revenue
                """);
        List<RecentInstitute> recent = jdbc.query("""
                select id, institute_name, username, status, registered_date
                from institutes order by registered_date desc limit 6
                """, (rs, n) -> new RecentInstitute(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), timestamp(rs, 5)));
        List<ExpiringSubscription> expiring = jdbc.query("""
                select i.id, i.institute_name, p.name, s.end_date, (s.end_date-current_date)
                from platform_current_subscriptions s join institutes i on i.id=s.institute_id
                join subscription_plans p on p.id=s.plan_id
                where s.effective_status in ('TRIAL','ACTIVE') and s.end_date between current_date and current_date + 30
                order by s.end_date asc limit 8
                """, (rs, n) -> new ExpiringSubscription(rs.getLong(1), rs.getString(2), rs.getString(3), date(rs, 4), rs.getLong(5)));
        return new Overview(number(row, "total_institutes"), number(row, "active_institutes"), number(row, "trial_institutes"),
                number(row, "suspended_institutes"), number(row, "expired_institutes"), number(row, "total_students"),
                number(row, "total_teachers"), number(row, "active_subscriptions"), number(row, "expiring_7"),
                number(row, "expiring_30"), number(row, "gateway_enabled"), decimal(row, "monthly_revenue"),
                decimal(row, "yearly_revenue"), recent, expiring);
    }

    public PageResponse<InstituteRow> institutes(int requestedPage, int requestedSize, String search, String status,
                                                  String type, String plan, String state, String city,
                                                  String subscriptionStatus, String gatewayStatus,
                                                  LocalDate registeredFrom, LocalDate registeredTo,
                                                  LocalDate expiryFrom, LocalDate expiryTo, String sort, String direction) {
        int page = Math.max(0, requestedPage);
        int size = PAGE_SIZES.contains(requestedSize) ? requestedSize : 25;
        List<String> where = new ArrayList<>(List.of("1=1"));
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (StringUtils.hasText(search)) {
            where.add("lower(concat_ws(' ',i.institute_name,i.username,i.email,i.contact,i.affiliation_no,i.city,i.state)) like :search");
            params.addValue("search", "%" + search.trim().toLowerCase() + "%");
        }
        addEquals(where, params, "i.status", "status", status);
        addEquals(where, params, "i.type", "type", type);
        addEquals(where, params, "i.state", "state", state);
        addEquals(where, params, "i.city", "city", city);
        addEquals(where, params, "p.code", "plan", plan);
        addEquals(where, params, "s.effective_status", "subscriptionStatus", subscriptionStatus);
        if (StringUtils.hasText(gatewayStatus)) {
            where.add("upper(coalesce(g.onboarding_status,'NOT_CONFIGURED')) = :gatewayStatus");
            params.addValue("gatewayStatus", gatewayStatus.trim().toUpperCase());
        }
        addDateRange(where, params, "i.registered_date", "registeredFrom", registeredFrom, true);
        addDateRange(where, params, "i.registered_date", "registeredTo", registeredTo, false);
        addDateRange(where, params, "s.end_date", "expiryFrom", expiryFrom, true);
        addDateRange(where, params, "s.end_date", "expiryTo", expiryTo, false);
        String clause = String.join(" and ", where);
        String filterBase = """
                from institutes i
                left join platform_current_subscriptions s on s.institute_id=i.id
                left join subscription_plans p on p.id=s.plan_id
                left join lateral (select gx.* from institute_payment_gateway_accounts gx where gx.institute_id=i.id order by gx.payments_enabled desc,gx.updated_at desc limit 1) g on true
                """;
        String dataBase = filterBase + """
                left join lateral (select count(*) student_count from students st where st.institute_id=i.id and lower(coalesce(st.status,'active')) <> 'archived') sc on true
                left join lateral (select count(*) teacher_count from teachers t where t.institute_id=i.id and lower(coalesce(t.status,'active')) <> 'archived') tc on true
                """;
        Long total = namedJdbc.queryForObject("select count(*) " + filterBase + " where " + clause, params, Long.class);
        String order = INSTITUTE_SORTS.getOrDefault(sort, "i.registered_date");
        String dir = "asc".equalsIgnoreCase(direction) ? "asc" : "desc";
        params.addValue("limit", size).addValue("offset", page * size);
        List<InstituteRow> content = namedJdbc.query("""
                select i.id,i.institute_name,i.username,i.type,i.city,i.state,i.status,p.name,
                  sc.student_count,tc.teacher_count,
                  (select count(*) from (
                    select pf.feature_code from subscription_plan_features pf
                    where pf.plan_id=s.plan_id and not exists(select 1 from institute_feature_overrides ox where ox.institute_id=i.id and ox.feature_code=pf.feature_code)
                    union all select ox.feature_code from institute_feature_overrides ox where ox.institute_id=i.id and ox.enabled=true
                  ) ef) enabled_features,
                  i.registered_date,s.end_date,s.effective_status,coalesce(g.onboarding_status,'NOT_CONFIGURED') gateway_status
                """ + dataBase + " where " + clause + " order by " + order + " " + dir + " limit :limit offset :offset",
                params, (rs, n) -> mapInstituteRow(rs));
        long count = total == null ? 0 : total;
        return new PageResponse<>(content, page, size, count, (int) Math.ceil((double) count / size));
    }

    public InstituteDetail institute(Long id) {
        return jdbc.query("""
                select i.id,i.institute_name,i.username,i.type,i.affiliation_no,i.affiliated_from,i.email,i.contact,
                  i.website,i.address,i.city,i.state,i.pincode,i.status,i.status_reason,i.registered_date,
                  (select count(*) from students x where x.institute_id=i.id and lower(coalesce(x.status,'active')) <> 'archived'),
                  (select count(*) from teachers x where x.institute_id=i.id and lower(coalesce(x.status,'active')) <> 'archived'),
                  (select count(*) from school_classes x where x.institute_id=i.id),
                  (select count(*) from class_sections x where x.institute_id=i.id and lower(coalesce(x.status,'active')) <> 'archived'),
                  p.name,s.effective_status,s.end_date,
                  (select count(*) from (
                    select pf.feature_code from subscription_plan_features pf where pf.plan_id=s.plan_id
                      and not exists(select 1 from institute_feature_overrides o where o.institute_id=i.id and o.feature_code=pf.feature_code)
                    union all select o.feature_code from institute_feature_overrides o where o.institute_id=i.id and o.enabled=true
                  ) ef),
                  g.provider,coalesce(g.onboarding_status,'NOT_CONFIGURED'),coalesce(g.payments_enabled,false),i.version
                from institutes i
                left join platform_current_subscriptions s on s.institute_id=i.id
                left join subscription_plans p on p.id=s.plan_id
                left join lateral (select gx.* from institute_payment_gateway_accounts gx where gx.institute_id=i.id order by gx.payments_enabled desc,gx.updated_at desc limit 1) g on true
                where i.id=?
                """, rs -> rs.next() ? mapInstituteDetail(rs) : null, id);
    }

    public List<FeatureAccess> features(Long instituteId) {
        ensureInstitute(instituteId);
        Map<String, Map<String, Object>> rows = new HashMap<>();
        jdbc.query("""
                select f.code,
                  exists(select 1 from subscription_plan_features pf where pf.plan_id=s.plan_id and pf.feature_code=f.code) plan_enabled,
                  o.enabled override_enabled,o.reason,o.updated_at,o.version,i.status,s.effective_status
                from %s f(code)
                join institutes i on i.id=?
                left join platform_current_subscriptions s on s.institute_id=i.id
                left join institute_feature_overrides o on o.institute_id=? and o.feature_code=f.code
                """.formatted(FeatureCode.sqlValues()), rs -> {
            Map<String, Object> value = new HashMap<>();
            value.put("plan", rs.getBoolean(2));
            value.put("override", rs.getObject(3));
            value.put("reason", rs.getString(4));
            value.put("updated", timestamp(rs, 5));
            value.put("version", rs.getObject(6));
            value.put("instituteStatus", rs.getString(7));
            value.put("subscriptionStatus", rs.getString(8));
            rows.put(rs.getString(1), value);
        }, instituteId, instituteId);
        return FeatureCode.registry().stream().map(def -> {
            Map<String, Object> row = rows.get(def.code());
            boolean planEnabled = Boolean.TRUE.equals(row.get("plan"));
            Boolean override = (Boolean) row.get("override");
            boolean configured = override == null ? planEnabled : override;
            String instituteStatus = (String) row.get("instituteStatus");
            String subscriptionStatus = (String) row.get("subscriptionStatus");
            boolean subscriptionAllows = "TRIAL".equals(subscriptionStatus) || "ACTIVE".equals(subscriptionStatus);
            boolean effective = configured && "ACTIVE".equals(instituteStatus) && subscriptionAllows;
            String blocked = !"ACTIVE".equals(instituteStatus) ? "INSTITUTE_" + instituteStatus
                    : !subscriptionAllows ? subscriptionStatus == null ? "SUBSCRIPTION_NOT_ASSIGNED" : "SUBSCRIPTION_" + subscriptionStatus : null;
            return new FeatureAccess(def.code(), def.legacyKey(), def.label(), planEnabled, override,
                    configured, effective, override == null ? "PLAN" : "MANUAL_OVERRIDE",
                    effective ? "ENABLED" : "BLOCKED", blocked, (String) row.get("reason"),
                    (LocalDateTime) row.get("updated"), asLong(row.get("version")));
        }).toList();
    }

    @Transactional
    public FeatureAccess updateFeature(Long instituteId, FeatureUpdate payload, AuthPrincipal actor, HttpServletRequest request) {
        ensureInstitute(instituteId);
        FeatureCode code = FeatureCode.valueOf(payload.featureCode().trim().toUpperCase());
        Map<String, Object> old = jdbc.query("select enabled,reason,version from institute_feature_overrides where institute_id=? and feature_code=?",
                rs -> rs.next() ? Map.of("enabled", rs.getBoolean(1), "reason", safe(rs.getString(2)), "version", rs.getLong(3)) : Map.of(), instituteId, code.name());
        Long currentVersion = asLong(old.get("version"));
        if (currentVersion != null && (payload.version() == null || !currentVersion.equals(payload.version()))) {
            throw new OptimisticLockingFailureException("Feature was updated by another platform user.");
        }
        int changed = jdbc.update("""
                insert into institute_feature_overrides(institute_id,feature_code,enabled,reason,updated_by_platform_user_id)
                values (?,?,?,?,?)
                on conflict (institute_id,feature_code) do update set enabled=excluded.enabled,reason=excluded.reason,
                  updated_by_platform_user_id=excluded.updated_by_platform_user_id,updated_at=now(),version=institute_feature_overrides.version+1
                """, instituteId, code.name(), payload.enabled(), payload.reason().trim(), actor.accountId());
        if (changed != 1) throw new OptimisticLockingFailureException("Feature was updated by another platform user.");
        audit.record(actor.accountId(), payload.enabled() ? "FEATURE_ENABLED" : "FEATURE_DISABLED", "FEATURE", code.name(), instituteId,
                old, Map.of("enabled", payload.enabled()), payload.reason(), request.getRemoteAddr(), request.getHeader("User-Agent"));
        return features(instituteId).stream().filter(item -> item.code().equals(code.name())).findFirst().orElseThrow();
    }

    public List<Plan> plans() {
        Map<Long, List<String>> features = new HashMap<>();
        jdbc.query("select plan_id,feature_code from subscription_plan_features order by feature_code", (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                features.computeIfAbsent(rs.getLong(1), ignored -> new ArrayList<>()).add(rs.getString(2)));
        return jdbc.query("select id,code,name,monthly_price,yearly_price,max_students,max_teachers,max_users,max_storage_mb,trial_days,status,version from subscription_plans order by case when status='ACTIVE' then 0 else 1 end,monthly_price,id",
                (rs, n) -> new Plan(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getBigDecimal(4),rs.getBigDecimal(5),
                        integer(rs,6),integer(rs,7),integer(rs,8),integer(rs,9),rs.getInt(10),rs.getString(11),
                        features.getOrDefault(rs.getLong(1),List.of()),rs.getLong(12)));
    }

    public Plan plan(Long id) {
        List<String> features = jdbc.queryForList("select feature_code from subscription_plan_features where plan_id=? order by feature_code", String.class, id);
        Plan result = jdbc.query("select id,code,name,monthly_price,yearly_price,max_students,max_teachers,max_users,max_storage_mb,trial_days,status,version from subscription_plans where id=?",
                rs -> rs.next() ? new Plan(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getBigDecimal(4),rs.getBigDecimal(5),
                        integer(rs,6),integer(rs,7),integer(rs,8),integer(rs,9),rs.getInt(10),rs.getString(11),features,rs.getLong(12)) : null,id);
        if (result == null) throw problem(HttpStatus.NOT_FOUND,"PLAN_NOT_FOUND");
        return result;
    }

    @Transactional
    public Plan savePlan(PlanPayload payload, AuthPrincipal actor, HttpServletRequest request) {
        String code = safe(payload.code()).trim().toUpperCase(Locale.ROOT);
        String status = safe(payload.status()).trim().toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9_]{1,40}")) throw problem(HttpStatus.BAD_REQUEST,"INVALID_PLAN_CODE");
        if (!StringUtils.hasText(payload.name()) || payload.name().trim().length()>100) throw problem(HttpStatus.BAD_REQUEST,"INVALID_PLAN_NAME");
        if (!Set.of("ACTIVE","INACTIVE").contains(status)) throw problem(HttpStatus.BAD_REQUEST,"INVALID_PLAN_STATUS");
        validateMoney(payload.monthlyPrice()); validateMoney(payload.yearlyPrice());
        if (payload.trialDays()<0 || payload.trialDays()>365) throw problem(HttpStatus.BAD_REQUEST,"INVALID_TRIAL_DAYS");
        validatePositiveLimit(payload.maxStudents(),"student"); validatePositiveLimit(payload.maxTeachers(),"teacher");
        validatePositiveLimit(payload.maxUsers(),"user"); validatePositiveLimit(payload.maxStorageMb(),"storage");
        List<String> codes;
        try { codes = payload.features()==null ? List.of() : payload.features().stream()
                .map(value -> FeatureCode.valueOf(value.trim().toUpperCase(Locale.ROOT)).name()).distinct().sorted().toList(); }
        catch (RuntimeException ex) { throw problem(HttpStatus.BAD_REQUEST,"INVALID_FEATURE"); }
        // Same lock order as default-plan settings and registration provisioning.
        jdbc.queryForList("select setting_key from platform_settings where setting_key='defaultPlan' for update");
        Long id = payload.id();
        Plan old = id==null ? null : plan(id);
        if (old!=null) {
            if (payload.version()==null || payload.version()!=old.version()) throw problem(HttpStatus.CONFLICT,"PLAN_MODIFIED_CONCURRENTLY");
            if (!old.code().equals(code)) throw problem(HttpStatus.BAD_REQUEST,"PLAN_CODE_IMMUTABLE");
            if (!"ACTIVE".equals(status) && Boolean.TRUE.equals(jdbc.queryForObject(
                    "select exists(select 1 from platform_settings where setting_key='defaultPlan' and upper(trim(setting_value))=?)",Boolean.class,code)))
                throw problem(HttpStatus.CONFLICT,"DEFAULT_PLAN_CANNOT_BE_DEACTIVATED");
        }
        try {
            if(id==null) id=jdbc.queryForObject("""
                    insert into subscription_plans(code,name,monthly_price,yearly_price,max_students,max_teachers,max_users,max_storage_mb,trial_days,status)
                    values (?,?,?,?,?,?,?,?,?,?) returning id
                    """,Long.class,code,payload.name().trim(),payload.monthlyPrice(),payload.yearlyPrice(),payload.maxStudents(),payload.maxTeachers(),payload.maxUsers(),payload.maxStorageMb(),payload.trialDays(),status);
            else if(jdbc.update("""
                    update subscription_plans set name=?,monthly_price=?,yearly_price=?,max_students=?,max_teachers=?,max_users=?,max_storage_mb=?,trial_days=?,status=?,updated_at=now(),version=version+1
                    where id=? and version=?
                    """,payload.name().trim(),payload.monthlyPrice(),payload.yearlyPrice(),payload.maxStudents(),payload.maxTeachers(),payload.maxUsers(),payload.maxStorageMb(),payload.trialDays(),status,id,payload.version())!=1)
                throw problem(HttpStatus.CONFLICT,"PLAN_MODIFIED_CONCURRENTLY");
        } catch(DuplicateKeyException ex) { throw problem(HttpStatus.CONFLICT,"PLAN_ALREADY_EXISTS"); }
        List<String> previous=old==null?List.of():old.features();
        Long planId=id;
        List<String> removed=previous.stream().filter(f->!codes.contains(f)).toList();
        List<String> added=codes.stream().filter(f->!previous.contains(f)).toList();
        jdbc.batchUpdate("delete from subscription_plan_features where plan_id=? and feature_code=?",removed,Math.max(1,removed.size()),(ps,f)->{ps.setLong(1,planId);ps.setString(2,f);});
        jdbc.batchUpdate("insert into subscription_plan_features(plan_id,feature_code) values (?,?)",added,Math.max(1,added.size()),(ps,f)->{ps.setLong(1,planId);ps.setString(2,f);});
        Plan saved=plan(id);
        auditPlan(old==null?"PLAN_CREATED":"PLAN_UPDATED",old,saved,payload.reason(),actor,request);
        if(old!=null) {
            if(!old.status().equals(saved.status())) auditPlan("ACTIVE".equals(saved.status())?"PLAN_ACTIVATED":"PLAN_DEACTIVATED",old,saved,payload.reason(),actor,request);
            if(!previous.equals(codes)) auditPlan("PLAN_FEATURES_CHANGED",old,saved,payload.reason(),actor,request);
            if(old.monthlyPrice().compareTo(saved.monthlyPrice())!=0 || old.yearlyPrice().compareTo(saved.yearlyPrice())!=0) auditPlan("PLAN_PRICE_CHANGED",old,saved,payload.reason(),actor,request);
            if(!Objects.equals(old.maxStudents(),saved.maxStudents()) || !Objects.equals(old.maxTeachers(),saved.maxTeachers()) || !Objects.equals(old.maxUsers(),saved.maxUsers()) || !Objects.equals(old.maxStorageMb(),saved.maxStorageMb())) auditPlan("PLAN_LIMITS_CHANGED",old,saved,payload.reason(),actor,request);
        }
        return saved;
    }

    @Transactional
    public Plan changePlanStatus(Long id, PlanStatus payload, AuthPrincipal actor, HttpServletRequest request) {
        Plan p=plan(id);
        return savePlan(new PlanPayload(id,p.code(),p.name(),p.monthlyPrice(),p.yearlyPrice(),p.maxStudents(),p.maxTeachers(),p.maxUsers(),p.maxStorageMb(),p.trialDays(),payload.status(),p.features(),payload.version(),payload.reason()),actor,request);
    }

    private void auditPlan(String action,Plan old,Plan saved,String reason,AuthPrincipal actor,HttpServletRequest request) {
        audit.record(actor.accountId(),action,"SUBSCRIPTION_PLAN",String.valueOf(saved.id()),null,old,saved,reason,request.getRemoteAddr(),request.getHeader("User-Agent"));
    }

    private void validateMoney(BigDecimal amount) {
        if(amount==null || amount.signum()<0 || amount.compareTo(new BigDecimal("999999999999.99"))>0 || amount.stripTrailingZeros().scale()>2)
            throw problem(HttpStatus.BAD_REQUEST,"INVALID_PLAN_PRICE");
    }
    private ResponseStatusException problem(HttpStatus status,String code) { return new ResponseStatusException(status,code); }

    public List<Subscription> subscriptions(Long instituteId) {
        ensureInstitute(instituteId);
        return jdbc.query("""
                select s.id,s.institute_id,s.plan_id,p.code,p.name,case when s.status in ('TRIAL','ACTIVE','PAST_DUE') and s.end_date<current_date then 'EXPIRED' else s.status end,s.billing_cycle,s.start_date,s.end_date,
                  s.amount,s.currency,s.auto_renew,s.change_reason,s.created_at,s.version
                from institute_subscriptions s join subscription_plans p on p.id=s.plan_id
                where s.institute_id=? order by s.created_at desc,s.id desc
                """, (rs,n)->mapSubscription(rs), instituteId);
    }

    public SubscriptionSummary subscriptionSummary() {
        return jdbc.query("""
                select (select count(*) from subscription_plans),
                  (select count(*) from subscription_plans where status='ACTIVE'),
                  count(*) filter(where effective_status='ACTIVE'),count(*) filter(where effective_status='TRIAL'),
                  count(*) filter(where effective_status in ('ACTIVE','TRIAL') and end_date between current_date and current_date+7),
                  count(*) filter(where effective_status in ('ACTIVE','TRIAL') and end_date between current_date and current_date+30)
                from platform_current_subscriptions
                """,rs->{rs.next();return new SubscriptionSummary(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getLong(4),rs.getLong(5),rs.getLong(6));});
    }

    public PageResponse<SubscriptionRow> subscriptionDirectory(int page,int size,String search,String status,String planCode) {
        return subscriptionDirectory(page,size,search,status,planCode,"",null,null,null);
    }

    public PageResponse<SubscriptionRow> subscriptionDirectory(int requestedPage,int requestedSize,String search,String status,String planCode,
                                                               String billingCycle,LocalDate expiryFrom,LocalDate expiryTo,Integer expiringDays) {
        int page=Math.max(0,requestedPage),size=PAGE_SIZES.contains(requestedSize)?requestedSize:25;
        if(expiryFrom!=null && expiryTo!=null && expiryTo.isBefore(expiryFrom)) throw problem(HttpStatus.BAD_REQUEST,"INVALID_SUBSCRIPTION_PERIOD");
        List<String> filters=new ArrayList<>(List.of("1=1"));
        MapSqlParameterSource params=new MapSqlParameterSource().addValue("limit",size).addValue("offset",page*size);
        if(StringUtils.hasText(search)){filters.add("lower(concat_ws(' ',i.institute_name,i.username)) like :search");params.addValue("search","%"+search.trim().toLowerCase(Locale.ROOT)+"%");}
        addEquals(filters,params,"s.effective_status","status",status);
        addEquals(filters,params,"p.code","plan",planCode);
        addEquals(filters,params,"s.billing_cycle","cycle",billingCycle);
        if(expiryFrom!=null){filters.add("s.end_date>=:expiryFrom");params.addValue("expiryFrom",expiryFrom);}
        if(expiryTo!=null){filters.add("s.end_date<=:expiryTo");params.addValue("expiryTo",expiryTo);}
        if(expiringDays!=null){
            if(!Set.of(7,30).contains(expiringDays)) throw problem(HttpStatus.BAD_REQUEST,"INVALID_EXPIRY_WINDOW");
            filters.add("s.effective_status in ('TRIAL','ACTIVE') and s.end_date between current_date and current_date+:days");params.addValue("days",expiringDays);
        }
        String from=" from platform_current_subscriptions s join institutes i on i.id=s.institute_id join subscription_plans p on p.id=s.plan_id ";
        String where=" where "+String.join(" and ",filters);
        Long total=namedJdbc.queryForObject("select count(*)"+from+where,params,Long.class);
        List<SubscriptionRow> rows=namedJdbc.query("select s.id,i.id,i.institute_name,i.username,p.id,p.code,p.name,s.effective_status,s.billing_cycle,s.start_date,s.end_date,s.amount,s.auto_renew"+from+where+" order by s.end_date asc,i.id limit :limit offset :offset",params,
                (rs,n)->new SubscriptionRow(rs.getLong(1),rs.getLong(2),rs.getString(3),rs.getString(4),rs.getLong(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getString(9),date(rs,10),date(rs,11),rs.getBigDecimal(12),rs.getBoolean(13)));
        long count=total==null?0:total;return new PageResponse<>(rows,page,size,count,(int)Math.ceil((double)count/size));
    }

    public PageResponse<FeatureInstituteRow> featureDirectory(int requestedPage,int requestedSize,String search,String status) {
        int page=Math.max(0,requestedPage),size=PAGE_SIZES.contains(requestedSize)?requestedSize:25;
        String term="%"+safe(search).trim().toLowerCase()+"%",st=safe(status).trim().toUpperCase();
        String from="""
                 from institutes i left join platform_current_subscriptions s on s.institute_id=i.id
                 left join subscription_plans p on p.id=s.plan_id
                """;
        String where=" where (?='' or lower(concat_ws(' ',i.institute_name,i.username)) like ?) and (?='' or s.effective_status=?) ";
        Long total=jdbc.queryForObject("select count(*)"+from+where,Long.class,safe(search),term,st,st);
        List<FeatureInstituteRow> rows=jdbc.query("""
                select i.id,i.institute_name,i.username,i.status,p.name,s.effective_status,
                  (select count(*) from (select pf.feature_code from subscription_plan_features pf where pf.plan_id=s.plan_id and not exists(select 1 from institute_feature_overrides o where o.institute_id=i.id and o.feature_code=pf.feature_code) union select o.feature_code from institute_feature_overrides o where o.institute_id=i.id and o.enabled) x) configured,
                  case when i.status='ACTIVE' and s.effective_status in ('TRIAL','ACTIVE') then (select count(*) from (select pf.feature_code from subscription_plan_features pf where pf.plan_id=s.plan_id and not exists(select 1 from institute_feature_overrides o where o.institute_id=i.id and o.feature_code=pf.feature_code) union select o.feature_code from institute_feature_overrides o where o.institute_id=i.id and o.enabled) y) else 0 end effective
                """+from+where+" order by i.institute_name limit ? offset ?",
                (rs,n)->new FeatureInstituteRow(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getLong(7),rs.getLong(8)),safe(search),term,st,st,size,page*size);
        long count=total==null?0:total;return new PageResponse<>(rows,page,size,count,(int)Math.ceil((double)count/size));
    }

    @Transactional
    public Subscription changeSubscription(Long instituteId, SubscriptionChange payload, AuthPrincipal actor, HttpServletRequest request) {
        if(payload.startDate()==null || payload.endDate()==null || payload.endDate().isBefore(payload.startDate()))
            throw problem(HttpStatus.BAD_REQUEST,"INVALID_SUBSCRIPTION_PERIOD");
        String status=normalizeStatus(payload.status()),cycle=normalizeCycle(payload.billingCycle());
        if(Set.of("TRIAL","ACTIVE","PAST_DUE").contains(status) && payload.startDate().isAfter(LocalDate.now()))
            throw problem(HttpStatus.BAD_REQUEST,"INVALID_SUBSCRIPTION_PERIOD: Current subscriptions cannot start in the future.");
        // Row locks serialize changes and keep plan activation/pricing stable until commit.
        if(jdbc.queryForList("select id from institutes where id=? for update",Long.class,instituteId).isEmpty()) throw new ResourceNotFoundException("Institute not found.");
        if(jdbc.queryForList("select id from subscription_plans where id=? for share",Long.class,payload.planId()).isEmpty()) throw problem(HttpStatus.NOT_FOUND,"PLAN_NOT_FOUND");
        Plan plan=plan(payload.planId());
        if(!"ACTIVE".equals(plan.status())) throw problem(HttpStatus.CONFLICT,"PLAN_INACTIVE");
        List<Subscription> old=subscriptions(instituteId);
        Subscription prior=old.isEmpty()?null:old.get(0);
        if(!Objects.equals(payload.currentSubscriptionId(),prior==null?null:prior.id()) ||
                (prior!=null && !Objects.equals(payload.currentVersion(),prior.version()))) throw problem(HttpStatus.CONFLICT,"SUBSCRIPTION_CONFLICT");
        BigDecimal normal="TRIAL".equals(status)?BigDecimal.ZERO:switch(cycle){case "MONTHLY"->plan.monthlyPrice();case "YEARLY"->plan.yearlyPrice();default->null;};
        BigDecimal amount=payload.amount()==null?normal:payload.amount();
        if(amount==null || amount.signum()<0 || amount.stripTrailingZeros().scale()>2 || amount.precision()-amount.scale()>12) throw problem(HttpStatus.BAD_REQUEST,"INVALID_PLAN_PRICE");
        boolean override=normal==null || amount.compareTo(normal)!=0;
        if(override && !StringUtils.hasText(payload.reason())) throw problem(HttpStatus.BAD_REQUEST,"SUBSCRIPTION_PRICE_OVERRIDE_REASON_REQUIRED");
        if(!StringUtils.hasText(payload.reason()) || payload.reason().trim().length()>500) throw problem(HttpStatus.BAD_REQUEST,"SUBSCRIPTION_REASON_REQUIRED");
        jdbc.update("""
                update institute_subscriptions set status=case when end_date<current_date then 'EXPIRED' else 'CANCELLED' end,updated_at=now(),version=version+1
                where institute_id=? and status in ('TRIAL','ACTIVE','PAST_DUE')
                """,instituteId);
        Long id;
        try { id=jdbc.queryForObject("""
                insert into institute_subscriptions(institute_id,plan_id,status,billing_cycle,start_date,end_date,amount,currency,auto_renew,change_reason,created_by_platform_user_id)
                values (?,?,?,?,?,?,?,?,?,?,?) returning id
                """,Long.class,instituteId,payload.planId(),status,cycle,payload.startDate(),payload.endDate(),amount,"INR",payload.autoRenew(),payload.reason().trim(),actor.accountId()); }
        catch(DuplicateKeyException ex){throw problem(HttpStatus.CONFLICT,"SUBSCRIPTION_CONFLICT");}
        Subscription current=subscriptions(instituteId).stream().filter(v->v.id().equals(id)).findFirst().orElseThrow();
        audit.record(actor.accountId(),prior==null?"SUBSCRIPTION_ASSIGNED":"SUBSCRIPTION_CHANGED","SUBSCRIPTION",String.valueOf(id),instituteId,prior,current,payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        if(override) audit.record(actor.accountId(),"SUBSCRIPTION_PRICE_OVERRIDE","SUBSCRIPTION",String.valueOf(id),instituteId,normal,amount,payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        return current;
    }

    @Transactional
    public Subscription extendTrial(Long instituteId,TrialExtension payload,AuthPrincipal actor,HttpServletRequest request) {
        jdbc.queryForList("select id from institutes where id=? for update",Long.class,instituteId);
        Subscription old=subscriptions(instituteId).stream().findFirst().orElseThrow(()->problem(HttpStatus.NOT_FOUND,"SUBSCRIPTION_NOT_FOUND"));
        if(!"TRIAL".equals(old.status()) || old.version()!=payload.version()) throw problem(HttpStatus.CONFLICT,"SUBSCRIPTION_CONFLICT");
        if(!payload.endDate().isAfter(old.endDate())) throw problem(HttpStatus.BAD_REQUEST,"INVALID_SUBSCRIPTION_PERIOD");
        if(payload.reason().trim().length()>500) throw problem(HttpStatus.BAD_REQUEST,"INVALID_REASON");
        if(jdbc.update("update institute_subscriptions set end_date=?,updated_at=now(),version=version+1 where id=? and version=?",payload.endDate(),old.id(),payload.version())!=1)
            throw problem(HttpStatus.CONFLICT,"SUBSCRIPTION_CONFLICT");
        Subscription next=subscriptions(instituteId).stream().filter(x->x.id().equals(old.id())).findFirst().orElseThrow();
        audit.record(actor.accountId(),"TRIAL_EXTENDED","SUBSCRIPTION",String.valueOf(old.id()),instituteId,old,next,payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        return next;
    }

    @Transactional
    public Subscription endTrial(Long instituteId,StatusChange payload,AuthPrincipal actor,HttpServletRequest request) {
        jdbc.queryForList("select id from institutes where id=? for update",Long.class,instituteId);
        Subscription old=subscriptions(instituteId).stream().findFirst().orElseThrow(()->problem(HttpStatus.NOT_FOUND,"SUBSCRIPTION_NOT_FOUND"));
        if(!"TRIAL".equals(old.status()) || !Objects.equals(payload.version(),old.version())) throw problem(HttpStatus.CONFLICT,"SUBSCRIPTION_CONFLICT");
        if(jdbc.update("update institute_subscriptions set status='CANCELLED',updated_at=now(),version=version+1 where id=? and version=?",old.id(),payload.version())!=1)
            throw problem(HttpStatus.CONFLICT,"SUBSCRIPTION_CONFLICT");
        Subscription next=subscriptions(instituteId).stream().filter(x->x.id().equals(old.id())).findFirst().orElseThrow();
        audit.record(actor.accountId(),"TRIAL_ENDED","SUBSCRIPTION",String.valueOf(old.id()),instituteId,old,next,payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        return next;
    }

    public Usage usage(Long instituteId) {
        ensureInstitute(instituteId);
        Map<String,Object> r=jdbc.queryForMap("""
                select
                  (select count(*) from students where institute_id=? and lower(coalesce(status,'active'))<>'archived') students,
                  (select count(*) from teachers where institute_id=? and lower(coalesce(status,'active'))<>'archived') teachers,
                  (select count(*) from user_accounts where institute_id=? and status='ACTIVE') accounts,
                  (select count(*) from school_classes where institute_id=?) classes,
                  (select count(*) from class_sections where institute_id=? and lower(coalesce(status,'active'))<>'archived') sections,
                  (select count(*) from exams where institute_id=?) exams,
                  (select count(*) from library_books where institute_id=?) books,
                  (select count(*) from hostel_residents where institute_id=? and lower(coalesce(status,'active'))='active') residents,
                  (select count(*) from transport_assignments where institute_id=? and lower(coalesce(status,'active'))='active') transport,
                  p.name plan,p.max_students,p.max_teachers,p.max_users
                from institutes i
                left join platform_current_subscriptions s on s.institute_id=i.id
                left join subscription_plans p on p.id=s.plan_id
                where i.id=?
                """, instituteId,instituteId,instituteId,instituteId,instituteId,instituteId,instituteId,instituteId,instituteId,instituteId);
        return new Usage(instituteId,number(r,"students"),number(r,"teachers"),number(r,"accounts"),number(r,"classes"),
                number(r,"sections"),number(r,"exams"),number(r,"books"),number(r,"residents"),number(r,"transport"),
                (String)r.get("plan"),(Integer)r.get("max_students"),(Integer)r.get("max_teachers"),(Integer)r.get("max_users"),
                percent(number(r,"students"),(Integer)r.get("max_students")),percent(number(r,"teachers"),(Integer)r.get("max_teachers")),
                percent(number(r,"accounts"),(Integer)r.get("max_users")));
    }

    public UsageOverview usageOverview() {
        Map<String,Object> r=jdbc.queryForMap("""
                select (select count(*) from institutes) institutes,
                  (select count(*) from students where lower(coalesce(status,'active'))<>'archived') students,
                  (select count(*) from teachers where lower(coalesce(status,'active'))<>'archived') teachers,
                  (select count(*) from user_accounts where status='ACTIVE') accounts,
                  (select count(*) from school_classes) classes,
                  (select count(*) from class_sections where lower(coalesce(status,'active'))<>'archived') sections,
                  (select count(*) from library_books) books,
                  (select count(*) from hostel_residents where lower(coalesce(status,'active'))='active') residents,
                  (select count(*) from transport_assignments where lower(coalesce(status,'active'))='active') transport
                """);
        return new UsageOverview(number(r,"institutes"),number(r,"students"),number(r,"teachers"),number(r,"accounts"),number(r,"classes"),number(r,"sections"),number(r,"books"),number(r,"residents"),number(r,"transport"));
    }

    public PageResponse<UsageRow> usageDirectory(int requestedPage,int requestedSize,String search,String limitStatus) {
        int page=Math.max(0,requestedPage),size=PAGE_SIZES.contains(requestedSize)?requestedSize:25;
        String term="%"+safe(search).trim().toLowerCase()+"%";
        String status=safe(limitStatus).trim().toUpperCase();
        if ("LIMIT_REACHED".equals(status)) status="OVER_LIMIT";
        String usageCte="""
                with usage_rows as (
                  select i.id,i.institute_name,i.username,i.status,p.name plan,
                    (select count(*) from students x where x.institute_id=i.id and lower(coalesce(x.status,'active'))<>'archived') students,p.max_students,
                    (select count(*) from teachers x where x.institute_id=i.id and lower(coalesce(x.status,'active'))<>'archived') teachers,p.max_teachers,
                    (select count(*) from user_accounts x where x.institute_id=i.id and x.status='ACTIVE') accounts,p.max_users
                  from institutes i left join platform_current_subscriptions s on s.institute_id=i.id
                  left join subscription_plans p on p.id=s.plan_id
                )
                """;
        String where=" where (?='' or lower(concat_ws(' ',institute_name,username)) like ?) and (?='' or "
                + "case when (max_students is not null and students>max_students) or (max_teachers is not null and teachers>max_teachers) or (max_users is not null and accounts>max_users) then 'OVER_LIMIT' "
                + "when (max_students is not null and students*100>=max_students*80) or (max_teachers is not null and teachers*100>=max_teachers*80) or (max_users is not null and accounts*100>=max_users*80) then 'NEAR_LIMIT' else 'NORMAL' end=?)";
        Long total=jdbc.queryForObject(usageCte+"select count(*) from usage_rows"+where,Long.class,safe(search),term,status,status);
        List<UsageRow> rows=jdbc.query(usageCte+"select *,case when (max_students is not null and students>max_students) or (max_teachers is not null and teachers>max_teachers) or (max_users is not null and accounts>max_users) then 'OVER_LIMIT' when (max_students is not null and students*100>=max_students*80) or (max_teachers is not null and teachers*100>=max_teachers*80) or (max_users is not null and accounts*100>=max_users*80) then 'NEAR_LIMIT' else 'NORMAL' end limit_status from usage_rows"+where+" order by institute_name limit ? offset ?",
                (rs,n)->new UsageRow(rs.getLong("id"),rs.getString("institute_name"),rs.getString("username"),rs.getString("status"),rs.getString("plan"),rs.getLong("students"),(Integer)rs.getObject("max_students"),rs.getLong("teachers"),(Integer)rs.getObject("max_teachers"),rs.getLong("accounts"),(Integer)rs.getObject("max_users"),rs.getString("limit_status")),
                safe(search),term,status,status,size,page*size);
        long count=total==null?0:total;return new PageResponse<>(rows,page,size,count,(int)Math.ceil((double)count/size));
    }

    public Gateway gateway(Long instituteId) {
        ensureInstitute(instituteId);
        return jdbc.query("""
                select provider,external_account_id,onboarding_status,product_status,payments_enabled,last_sync_at
                from institute_payment_gateway_accounts where institute_id=? order by payments_enabled desc,updated_at desc limit 1
                """, rs -> rs.next() ? new Gateway(instituteId,rs.getString(1),mask(rs.getString(2)),rs.getString(3),rs.getString(4),rs.getBoolean(5),timestamp(rs,6))
                : new Gateway(instituteId,"NOT_CONFIGURED",null,"NOT_CONFIGURED",null,false,null), instituteId);
    }

    public PageResponse<GatewayRow> gateways(int requestedPage,int requestedSize,String search,String provider,String status) {
        int page=Math.max(0,requestedPage),size=PAGE_SIZES.contains(requestedSize)?requestedSize:25;
        String where=" where (?='' or lower(concat_ws(' ',i.institute_name,i.username,g.external_account_id)) like ?) and (?='' or g.provider=?) and (?='' or g.onboarding_status=?) ";
        String term="%"+safe(search).trim().toLowerCase()+"%",p=safe(provider).trim().toUpperCase(),st=safe(status).trim().toUpperCase();
        String from=" from institute_payment_gateway_accounts g join institutes i on i.id=g.institute_id ";
        Long total=jdbc.queryForObject("select count(*)"+from+where,Long.class,safe(search),term,p,p,st,st);
        List<GatewayRow> rows=jdbc.query("select i.id,i.institute_name,i.username,g.provider,g.external_account_id,g.onboarding_status,g.product_status,g.payments_enabled,g.last_sync_at"+from+where+"order by g.updated_at desc limit ? offset ?",
                (rs,n)->new GatewayRow(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getString(4),mask(rs.getString(5)),rs.getString(6),rs.getString(7),rs.getBoolean(8),timestamp(rs,9)),safe(search),term,p,p,st,st,size,page*size);
        long count=total==null?0:total;return new PageResponse<>(rows,page,size,count,(int)Math.ceil((double)count/size));
    }

    public PageResponse<Invoice> invoices(int page, int size, Long instituteId, String status, String search, LocalDate dueFrom, LocalDate dueTo) {
        int safePage=Math.max(0,page), safeSize=PAGE_SIZES.contains(size)?size:25;
        MapSqlParameterSource params=new MapSqlParameterSource().addValue("limit",safeSize).addValue("offset",safePage*safeSize);
        String from=" from platform_invoices v join institutes i on i.id=v.institute_id left join institute_subscriptions s on s.id=v.subscription_id left join subscription_plans p on p.id=s.plan_id ";
        List<String> filters=new ArrayList<>(List.of("1=1"));
        if(instituteId!=null){filters.add("v.institute_id=:instituteId");params.addValue("instituteId",instituteId);}
        if(StringUtils.hasText(status)){filters.add("v.status=:status");params.addValue("status",status.trim().toUpperCase());}
        if(StringUtils.hasText(search)){filters.add("lower(concat_ws(' ',v.invoice_number,i.institute_name,i.username,v.payment_reference)) like :search");params.addValue("search","%"+search.trim().toLowerCase()+"%");}
        if(dueFrom!=null){filters.add("v.due_date>=:dueFrom");params.addValue("dueFrom",dueFrom);}
        if(dueTo!=null){filters.add("v.due_date<=:dueTo");params.addValue("dueTo",dueTo);}
        String where=" where "+String.join(" and ",filters);
        Long count=namedJdbc.queryForObject("select count(*)"+from+where,params,Long.class);
        List<Invoice> content=namedJdbc.query("""
                select v.id,v.invoice_number,v.institute_id,i.institute_name,p.name,s.start_date,s.end_date,
                  v.amount,v.tax,v.total_amount,v.due_date,v.paid_at,v.status,v.payment_reference,v.notes,v.created_at,v.version
                """+from+where+" order by v.created_at desc limit :limit offset :offset",params,(rs,n)->mapInvoice(rs));
        long total=count==null?0:count;
        return new PageResponse<>(content,safePage,safeSize,total,(int)Math.ceil((double)total/safeSize));
    }

    @Transactional
    public Invoice createInvoice(InvoicePayload payload, AuthPrincipal actor, HttpServletRequest request) {
        ensureInstitute(payload.instituteId());
        String status = payload.status().trim().toUpperCase();
        if (!Set.of("DRAFT", "PENDING").contains(status)) {
            throw new IllegalArgumentException("INVALID_INITIAL_INVOICE_STATUS");
        }
        if (payload.subscriptionId()!=null) {
            Boolean belongs=jdbc.queryForObject("select exists(select 1 from institute_subscriptions where id=? and institute_id=?)",Boolean.class,payload.subscriptionId(),payload.instituteId());
            if (!Boolean.TRUE.equals(belongs)) throw new IllegalArgumentException("INVOICE_SUBSCRIPTION_INSTITUTE_MISMATCH");
        }
        String invoiceNumber=jdbc.queryForObject("select 'VDY-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('platform_invoice_number_seq')::text,6,'0')",String.class);
        BigDecimal total = payload.amount().add(payload.tax());
        Long id = jdbc.queryForObject("""
                insert into platform_invoices(institute_id,subscription_id,invoice_number,amount,tax,total_amount,due_date,status,payment_reference,notes)
                values (?,?,?,?,?,?,?,?,?,?) returning id
                """, Long.class,payload.instituteId(),payload.subscriptionId(),invoiceNumber,payload.amount(),payload.tax(),total,
                payload.dueDate(),status,payload.paymentReference(),payload.notes());
        Invoice saved = jdbc.query("""
                select v.id,v.invoice_number,v.institute_id,i.institute_name,p.name,s.start_date,s.end_date,
                  v.amount,v.tax,v.total_amount,v.due_date,v.paid_at,v.status,v.payment_reference,v.notes,v.created_at,v.version
                from platform_invoices v join institutes i on i.id=v.institute_id
                left join institute_subscriptions s on s.id=v.subscription_id left join subscription_plans p on p.id=s.plan_id
                where v.id=?
                """, rs -> rs.next()?mapInvoice(rs):null,id);
        audit.record(actor.accountId(),"INVOICE_CREATED","PLATFORM_INVOICE",String.valueOf(id),payload.instituteId(),null,saved,
                "Platform subscription invoice created",request.getRemoteAddr(),request.getHeader("User-Agent"));
        return saved;
    }

    @Transactional
    public Invoice changeInvoiceStatus(Long invoiceId,String target,InvoiceStatusChange payload,AuthPrincipal actor,HttpServletRequest request) {
        Invoice old=invoice(invoiceId);
        String next=target.toUpperCase();
        Map<String,Set<String>> transitions=Map.of(
                "DRAFT",Set.of("PENDING","CANCELLED"),"PENDING",Set.of("PAID","WAIVED","CANCELLED","OVERDUE"),
                "OVERDUE",Set.of("PAID","WAIVED","CANCELLED"));
        if (!transitions.getOrDefault(old.status(),Set.of()).contains(next)) throw new IllegalArgumentException("INVALID_INVOICE_STATUS_TRANSITION");
        if ("PAID".equals(next)&&!StringUtils.hasText(payload.paymentReference())) throw new IllegalArgumentException("PAYMENT_REFERENCE_REQUIRED");
        int changed=jdbc.update("update platform_invoices set status=?,payment_reference=case when ?='PAID' then ? else payment_reference end,paid_at=case when ?='PAID' then now() else paid_at end,notes=concat_ws(E'\\n',notes,?),updated_at=now(),version=version+1 where id=? and version=?",
                next,next,payload.paymentReference(),next,payload.reason().trim(),invoiceId,payload.version()==null?old.version():payload.version());
        if(changed!=1)throw new OptimisticLockingFailureException("Invoice was updated by another platform user.");
        Invoice saved=invoice(invoiceId);
        audit.record(actor.accountId(),"INVOICE_"+next,"PLATFORM_INVOICE",String.valueOf(invoiceId),old.instituteId(),old,saved,payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        return saved;
    }

    public int markOverdueInvoices() {
        return jdbc.update("update platform_invoices set status='OVERDUE',updated_at=now(),version=version+1 where status='PENDING' and due_date<current_date");
    }

    public List<InternalNote> notes(Long instituteId) {
        ensureInstitute(instituteId);
        return jdbc.query("""
                select n.id,n.institute_id,n.platform_user_id,u.display_name,n.note,n.created_at
                from institute_internal_notes n join platform_users u on u.id=n.platform_user_id
                where n.institute_id=? order by n.created_at desc limit 100
                """,(rs,n)->new InternalNote(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getString(4),rs.getString(5),timestamp(rs,6)),instituteId);
    }

    @Transactional
    public InternalNote addNote(Long instituteId, NotePayload payload, AuthPrincipal actor, HttpServletRequest request) {
        ensureInstitute(instituteId);
        Long id=jdbc.queryForObject("insert into institute_internal_notes(institute_id,platform_user_id,note) values (?,?,?) returning id",
                Long.class,instituteId,actor.accountId(),payload.note().trim());
        audit.record(actor.accountId(),"INTERNAL_NOTE_ADDED","INSTITUTE_NOTE",String.valueOf(id),instituteId,null,null,
                "Internal support note added",request.getRemoteAddr(),request.getHeader("User-Agent"));
        return jdbc.query("""
                select n.id,n.institute_id,n.platform_user_id,u.display_name,n.note,n.created_at
                from institute_internal_notes n join platform_users u on u.id=n.platform_user_id where n.id=?
                """,rs->rs.next()?new InternalNote(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getString(4),rs.getString(5),timestamp(rs,6)):null,id);
    }

    public PageResponse<AuditRow> audits(int page,int size,Long instituteId,String action,Long actorId,String targetType,LocalDate fromDate,LocalDate toDate) {
        int safePage=Math.max(0,page),safeSize=PAGE_SIZES.contains(size)?size:25;
        MapSqlParameterSource params=new MapSqlParameterSource().addValue("limit",safeSize).addValue("offset",safePage*safeSize);
        String from=" from platform_audit_logs a left join platform_users u on u.id=a.platform_user_id left join institutes i on i.id=a.target_institute_id ";
        List<String> filters=new ArrayList<>(List.of("1=1"));
        if(instituteId!=null){filters.add("a.target_institute_id=:instituteId");params.addValue("instituteId",instituteId);}
        if(StringUtils.hasText(action)){filters.add("a.action=:action");params.addValue("action",action.trim().toUpperCase());}
        if(actorId!=null){filters.add("a.platform_user_id=:actorId");params.addValue("actorId",actorId);}
        if(StringUtils.hasText(targetType)){filters.add("a.target_type=:targetType");params.addValue("targetType",targetType.trim().toUpperCase());}
        if(fromDate!=null){filters.add("a.created_at>=:fromDate");params.addValue("fromDate",fromDate);}
        if(toDate!=null){filters.add("a.created_at<:toDate + interval '1 day'");params.addValue("toDate",toDate);}
        String where=" where "+String.join(" and ",filters);
        Long count=namedJdbc.queryForObject("select count(*)"+from+where,params,Long.class);
        List<AuditRow> content=namedJdbc.query("""
                select a.id,a.platform_user_id,coalesce(u.display_name,'System'),a.action,a.target_type,a.target_id,a.target_institute_id,
                  i.institute_name,a.reason,a.old_value_json,a.new_value_json,a.ip_address,a.created_at
                """+from+where+" order by a.created_at desc limit :limit offset :offset",params,(rs,n)->new AuditRow(rs.getLong(1),nullableLong(rs,2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),
                        nullableLong(rs,7),rs.getString(8),rs.getString(9),rs.getString(10),rs.getString(11),rs.getString(12),timestamp(rs,13)));
        long total=count==null?0:count;
        return new PageResponse<>(content,safePage,safeSize,total,(int)Math.ceil((double)total/safeSize));
    }

    public List<PlatformSetting> settings() {
        return jdbc.query("select setting_key,setting_value,updated_at from platform_settings order by setting_key",
                (rs,n)->new PlatformSetting(rs.getString(1),rs.getString(2),timestamp(rs,3)));
    }

    @Transactional
    public List<PlatformSetting> updateSettings(SettingsUpdate payload,AuthPrincipal actor,HttpServletRequest request) {
        jdbc.queryForList("select setting_key from platform_settings where setting_key='defaultPlan' for update");
        validateSettings(payload);
        Map<String,String> updates=new LinkedHashMap<>();
        updates.put("defaultTrialDays",payload.defaultTrialDays()); updates.put("defaultPlan",payload.defaultPlan()==null?null:payload.defaultPlan().trim().toUpperCase(Locale.ROOT));
        updates.put("platformSupportEmail",payload.platformSupportEmail()); updates.put("platformSupportPhone",payload.platformSupportPhone());
        updates.put("registrationEnabled",payload.registrationEnabled());
        Map<String,String> old=new LinkedHashMap<>(); settings().forEach(value->old.put(value.key(),value.value()));
        updates.forEach((key,value)->{ if(value!=null) jdbc.update("""
                insert into platform_settings(setting_key,setting_value,updated_by_platform_user_id) values (?,?,?)
                on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by_platform_user_id=excluded.updated_by_platform_user_id,updated_at=now()
                """,key,value.trim(),actor.accountId()); });
        audit.record(actor.accountId(),"PLATFORM_SETTINGS_CHANGED","PLATFORM_SETTINGS","global",null,old,updates,payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        return settings();
    }

    @Transactional
    public InstituteDetail changeInstituteStatus(Long instituteId,String status,StatusChange payload,AuthPrincipal actor,HttpServletRequest request) {
        InstituteDetail old=requiredInstitute(instituteId);
        if (payload.version()!=null && payload.version()!=old.version()) throw new OptimisticLockingFailureException("Institute was updated by another platform user.");
        int changed=jdbc.update("update institutes set status=?,status_reason=?,suspended_at=case when ?='SUSPENDED' then now() else null end,updated_at=now(),version=version+1 where id=? and version=?",
                status,payload.reason().trim(),status,instituteId,old.version());
        if(changed!=1) throw new OptimisticLockingFailureException("Institute was updated by another platform user.");
        InstituteDetail next=requiredInstitute(instituteId);
        audit.record(actor.accountId(),"SUSPENDED".equals(status)?"INSTITUTE_SUSPENDED":"INSTITUTE_REACTIVATED","INSTITUTE",String.valueOf(instituteId),instituteId,
                Map.of("status",old.status()),Map.of("status",next.status()),payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        return next;
    }

    private InstituteDetail requiredInstitute(Long id){InstituteDetail value=institute(id);if(value==null)throw new ResourceNotFoundException("Institute not found with id: "+id);return value;}
    private Invoice invoice(Long id){
        Invoice value=jdbc.query("""
                select v.id,v.invoice_number,v.institute_id,i.institute_name,p.name,s.start_date,s.end_date,
                  v.amount,v.tax,v.total_amount,v.due_date,v.paid_at,v.status,v.payment_reference,v.notes,v.created_at,v.version
                from platform_invoices v join institutes i on i.id=v.institute_id
                left join institute_subscriptions s on s.id=v.subscription_id left join subscription_plans p on p.id=s.plan_id where v.id=?
                """,rs->rs.next()?mapInvoice(rs):null,id);
        if(value==null)throw new ResourceNotFoundException("Invoice not found with id: "+id);return value;
    }
    private void ensureInstitute(Long id){requiredInstitute(id);}
    private InstituteRow mapInstituteRow(ResultSet rs)throws SQLException{return new InstituteRow(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getLong(9),rs.getLong(10),rs.getLong(11),timestamp(rs,12),date(rs,13),rs.getString(14),rs.getString(15));}
    private InstituteDetail mapInstituteDetail(ResultSet rs)throws SQLException{return new InstituteDetail(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getString(9),rs.getString(10),rs.getString(11),rs.getString(12),rs.getString(13),rs.getString(14),rs.getString(15),timestamp(rs,16),rs.getLong(17),rs.getLong(18),rs.getLong(19),rs.getLong(20),rs.getString(21),rs.getString(22),date(rs,23),rs.getLong(24),rs.getString(25),rs.getString(26),rs.getBoolean(27),rs.getLong(28));}
    private Subscription mapSubscription(ResultSet rs)throws SQLException{return new Subscription(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),date(rs,8),date(rs,9),rs.getBigDecimal(10),rs.getString(11),rs.getBoolean(12),rs.getString(13),timestamp(rs,14),rs.getLong(15));}
    private Invoice mapInvoice(ResultSet rs)throws SQLException{return new Invoice(rs.getLong(1),rs.getString(2),rs.getLong(3),rs.getString(4),rs.getString(5),date(rs,6),date(rs,7),rs.getBigDecimal(8),rs.getBigDecimal(9),rs.getBigDecimal(10),date(rs,11),timestamp(rs,12),rs.getString(13),rs.getString(14),rs.getString(15),timestamp(rs,16),rs.getLong(17));}
    private void addEquals(List<String>w,MapSqlParameterSource p,String col,String key,String value){if(StringUtils.hasText(value)){w.add("lower("+col+")=lower(:"+key+")");p.addValue(key,value.trim());}}
    private void addDateRange(List<String>w,MapSqlParameterSource p,String col,String key,LocalDate value,boolean from){if(value!=null){w.add(col+(from?" >= ":" < ")+":"+key+(from?"":" + interval '1 day'"));p.addValue(key,value);}}
    private long number(Map<String,Object>r,String key){Object v=r.get(key);return v instanceof Number n?n.longValue():0;}
    private BigDecimal decimal(Map<String,Object>r,String key){Object v=r.get(key);return v instanceof BigDecimal b?b:new BigDecimal(String.valueOf(v==null?0:v));}
    private Integer integer(ResultSet rs,int index)throws SQLException{int v=rs.getInt(index);return rs.wasNull()?null:v;}
    private Long nullableLong(ResultSet rs,int index)throws SQLException{long v=rs.getLong(index);return rs.wasNull()?null:v;}
    private Long asLong(Object value){return value instanceof Number n?n.longValue():null;}
    private LocalDate date(ResultSet rs,int index)throws SQLException{Date v=rs.getDate(index);return v==null?null:v.toLocalDate();}
    private LocalDateTime timestamp(ResultSet rs,int index)throws SQLException{Timestamp v=rs.getTimestamp(index);return v==null?null:v.toLocalDateTime();}
    private String safe(String value){return value==null?"":value;}
    private String mask(String value){if(!StringUtils.hasText(value)||value.length()<5)return value;return value.substring(0,3)+"***"+value.substring(value.length()-3);}
    private String normalizeStatus(String value){String v=value.trim().toUpperCase();if(!Set.of("TRIAL","ACTIVE","PAST_DUE","EXPIRED","CANCELLED").contains(v))throw new IllegalArgumentException("Invalid subscription status.");return v;}
    private String normalizeCycle(String value){String v=value.trim().toUpperCase();if(!Set.of("MONTHLY","YEARLY","CUSTOM").contains(v))throw new IllegalArgumentException("Invalid billing cycle.");return v;}
    private void validatePositiveLimit(Integer value,String label){if(value!=null&&value<0)throw problem(HttpStatus.BAD_REQUEST,"INVALID_PLAN_LIMIT");}
    private double percent(long used,Integer limit){return limit==null?0:limit==0?(used>0?100:0):Math.min(100d,used*100d/limit);}
    private void validateSettings(SettingsUpdate payload) {
        if (payload.defaultPlan()!=null && !StringUtils.hasText(payload.defaultPlan())) throw problem(HttpStatus.BAD_REQUEST,"PLAN_NOT_FOUND");
        if (StringUtils.hasText(payload.defaultTrialDays())) {
            try {
                int days = Integer.parseInt(payload.defaultTrialDays().trim());
                if (days < 0 || days > 365) throw new NumberFormatException();
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("Default trial days must be between 0 and 365.");
            }
        }
        if (StringUtils.hasText(payload.registrationEnabled())
                && !Set.of("true", "false").contains(payload.registrationEnabled().trim().toLowerCase())) {
            throw new IllegalArgumentException("Registration enabled must be true or false.");
        }
        if (StringUtils.hasText(payload.defaultPlan())) {
            Integer count = jdbc.queryForObject("select count(*) from subscription_plans where code=? and status='ACTIVE'",
                    Integer.class, payload.defaultPlan().trim().toUpperCase());
            if (count == null || count == 0) throw new IllegalArgumentException("Default plan must be an active plan code.");
        }
    }
}
