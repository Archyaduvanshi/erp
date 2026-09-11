package com.erp.backend.platform;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.platform.dto.PlatformDtos.*;
import com.erp.backend.platform.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

/** Real PostgreSQL tests in a private schema. No application tables are modified. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SubscriptionManagementTest {
    @Configuration @EnableTransactionManagement static class TxConfiguration {}
    private AnnotationConfigApplicationContext context;
    private JdbcTemplate jdbc, admin;
    private PlatformConsoleService service;
    private TransactionTemplate tx;
    private EntitlementService entitlements;
    private PlanLimitService limits;
    private String schema;
    private final AuthPrincipal actor=new AuthPrincipal(1L,null,"SUPER_ADMIN",null,null,"test",false);
    private final MockHttpServletRequest request=new MockHttpServletRequest();

    @BeforeAll void setup() throws Exception {
        Properties env=new Properties();
        Path file=Path.of(".env");
        if(Files.exists(file)) try(var reader=Files.newBufferedReader(file)){env.load(reader);}
        String url=System.getenv().getOrDefault("SPRING_DATASOURCE_URL",env.getProperty("SPRING_DATASOURCE_URL","jdbc:postgresql://localhost:5432/erp_db"));
        String user=System.getenv().getOrDefault("SPRING_DATASOURCE_USERNAME",env.getProperty("SPRING_DATASOURCE_USERNAME","postgres"));
        String password=System.getenv().getOrDefault("SPRING_DATASOURCE_PASSWORD",env.getProperty("SPRING_DATASOURCE_PASSWORD",""));
        admin=new JdbcTemplate(new DriverManagerDataSource(url,user,password));
        schema="subscription_test_"+UUID.randomUUID().toString().replace("-","");
        admin.execute("create schema "+schema);
        var source=new DriverManagerDataSource(url+(url.contains("?")?"&":"?")+"currentSchema="+schema,user,password);
        jdbc=new JdbcTemplate(source);
        jdbc.execute("""
            create table institutes(id bigserial primary key,institute_name text,username text,type text,affiliation_no text,affiliated_from text,email text,contact text,website text,address text,city text,state text,pincode text,registered_date timestamp default now());
            create table students(id bigserial primary key,institute_id bigint,status text);
            create table teachers(id bigserial primary key,institute_id bigint,status text);
            create table user_accounts(id bigserial primary key,institute_id bigint,status text);
            create table school_classes(id bigserial primary key,institute_id bigint);
            create table class_sections(id bigserial primary key,institute_id bigint,status text);
            create table exams(id bigserial primary key,institute_id bigint);
            create table library_books(id bigserial primary key,institute_id bigint);
            create table hostel_residents(id bigserial primary key,institute_id bigint,status text);
            create table transport_assignments(id bigserial primary key,institute_id bigint,status text);
            create table cashfree_merchant_accounts(id bigserial primary key,institute_id bigint,merchant_id text,onboarding_status text,product_status text,payments_enabled boolean,created_at timestamp,updated_at timestamp);
            """);
        for(String migration:List.of("V40__platform_admin_console.sql","V41__add_holiday_platform_entitlement.sql","V42__platform_console_hardening.sql","V43__sync_cashfree_platform_gateway.sql","V44__subscription_plan_management.sql","V45__cashfree_merchant_link_history.sql"))
            jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration",migration)));
        jdbc.update("insert into platform_users(id,normalized_username,display_name,password_hash) values(1,'test','Test','unused')");
        var manager=new DataSourceTransactionManager(source);
        tx=new TransactionTemplate(manager);
        context=new AnnotationConfigApplicationContext();
        context.register(TxConfiguration.class);
        context.registerBean(org.springframework.transaction.PlatformTransactionManager.class,()->manager);
        context.registerBean(JdbcTemplate.class,()->jdbc);
        context.registerBean(NamedParameterJdbcTemplate.class,()->new NamedParameterJdbcTemplate(jdbc));
        context.registerBean(ObjectMapper.class,()->new ObjectMapper().findAndRegisterModules());
        context.register(PlatformAuditService.class,PlatformConsoleService.class,PlanLimitService.class,EntitlementService.class,PlatformProvisioningService.class,SubscriptionExpiryJob.class);
        context.refresh();
        service=context.getBean(PlatformConsoleService.class);
        limits=context.getBean(PlanLimitService.class);
        entitlements=context.getBean(EntitlementService.class);
    }

    @Test void receiptSequenceRepairPreservesExistingReceiptsAndSequence() throws Exception {
        jdbc.execute("create table fee_payments(receipt_number text)");
        jdbc.execute("insert into fee_payments values ('FEE-2026-000042'), ('MANUAL-RECEIPT')");
        String migration=Files.readString(Path.of("src/main/resources/db/migration/V46__repair_fee_receipt_sequence.sql"));
        jdbc.execute(migration);
        assertEquals(43L, jdbc.queryForObject("select nextval('fee_receipt_seq')", Long.class));
        jdbc.execute("select setval('fee_receipt_seq', 100, true)");
        jdbc.execute(migration);
        assertEquals(101L, jdbc.queryForObject("select nextval('fee_receipt_seq')", Long.class));
    }

    @AfterAll void cleanup() {
        if(context!=null) context.close();
        if(admin!=null && schema!=null && schema.matches("subscription_test_[a-f0-9]{32}")) admin.execute("drop schema "+schema+" cascade");
    }

    private String code(){return "TEST_"+UUID.randomUUID().toString().replace("-","").substring(0,12).toUpperCase();}
    private PlanPayload payload(String code,BigDecimal price,Integer students,List<String> features){return new PlanPayload(null,code,"Test Plan",price,new BigDecimal("29999"),students,50,100,5120,15,"ACTIVE",features,null,"Test");}
    private Plan create(){return service.savePlan(payload(code(),new BigDecimal("2999"),500,List.of("STUDENT_MANAGEMENT","FEES")),actor,request);}
    private PlanPayload edit(Plan p,BigDecimal price,List<String> features){return new PlanPayload(p.id(),p.code(),p.name(),price,p.yearlyPrice(),p.maxStudents(),p.maxTeachers(),p.maxUsers(),p.maxStorageMb(),p.trialDays(),p.status(),features,p.version(),"Test edit");}
    private long institute(){return jdbc.queryForObject("insert into institutes(institute_name,username,type,status) values ('Test Institute',?,'School','ACTIVE') returning id",Long.class,code());}
    private Subscription assign(long institute,Plan plan,String status,Subscription prior,BigDecimal amount,String reason){return service.changeSubscription(institute,new SubscriptionChange(plan.id(),status,"MONTHLY",LocalDate.now(),LocalDate.now().plusDays(15),amount,false,reason,prior==null?null:prior.id(),prior==null?null:prior.version()),actor,request);}
    private void error(String code,Runnable work){var ex=assertThrows(ResponseStatusException.class,work::run);assertEquals(code,ex.getReason());}

    @Test void createNormalizesAndAuditsAndRejectsDuplicates() {
        String code=code();Plan p=service.savePlan(payload(" "+code.toLowerCase()+" ",new BigDecimal("2999"),500,List.of("FEES","FEES")),actor,request);
        assertEquals(code,p.code());assertEquals(List.of("FEES"),p.features());assertEquals(1,p.featureCount());
        assertEquals(1,jdbc.queryForObject("select count(*) from platform_audit_logs where action='PLAN_CREATED' and target_id=?",Integer.class,p.id().toString()));
        error("PLAN_ALREADY_EXISTS",()->service.savePlan(payload(code.toLowerCase(),BigDecimal.ZERO,null,List.of()),actor,request));
    }
    @Test void validatesMoneyLimitsAndRegistryAndAllowsZeroUnlimited() {
        error("INVALID_PLAN_PRICE",()->service.savePlan(payload(code(),new BigDecimal("-100"),500,List.of()),actor,request));
        error("INVALID_PLAN_PRICE",()->service.savePlan(payload(code(),new BigDecimal("1.001"),500,List.of()),actor,request));
        error("INVALID_PLAN_LIMIT",()->service.savePlan(payload(code(),BigDecimal.ZERO,-1,List.of()),actor,request));
        error("INVALID_FEATURE",()->service.savePlan(payload(code(),BigDecimal.ZERO,null,List.of("UNKNOWN_FEATURE")),actor,request));
        assertEquals(0,service.savePlan(payload(code(),BigDecimal.ZERO,0,List.of()),actor,request).maxStudents());
        assertNull(service.savePlan(payload(code(),BigDecimal.ZERO,null,List.of()),actor,request).maxStudents());
    }
    @Test void planCodeIsImmutableAndStaleEditsReturn409() {
        Plan p=create();service.savePlan(edit(p,new BigDecimal("3999"),p.features()),actor,request);
        var ex=assertThrows(ResponseStatusException.class,()->service.savePlan(edit(p,BigDecimal.ZERO,p.features()),actor,request));
        assertEquals(409,ex.getStatusCode().value());assertEquals("PLAN_MODIFIED_CONCURRENTLY",ex.getReason());
        Plan current=service.plan(p.id());
        error("PLAN_CODE_IMMUTABLE",()->service.savePlan(new PlanPayload(current.id(),code(),current.name(),current.monthlyPrice(),current.yearlyPrice(),null,null,null,null,15,"ACTIVE",current.features(),current.version(),"rename"),actor,request));
    }
    @Test void featureFailureRollsBackWholePlanAndAudit() {
        jdbc.execute("create function reject_test_feature() returns trigger language plpgsql as $$ begin if NEW.feature_code='LIBRARY' then raise exception 'test feature failure'; end if; return NEW; end $$");
        jdbc.execute("create trigger reject_test_feature before insert on subscription_plan_features for each row execute function reject_test_feature()");
        String code=code();
        try { assertThrows(RuntimeException.class,()->service.savePlan(payload(code,BigDecimal.ZERO,null,List.of("LIBRARY")),actor,request));
            assertEquals(0,jdbc.queryForObject("select count(*) from subscription_plans where code=?",Integer.class,code)); }
        finally {jdbc.execute("drop trigger reject_test_feature on subscription_plan_features");jdbc.execute("drop function reject_test_feature()");}
    }
    @Test void featureChangesAreDynamicAndOverridesWinAndHistoricalMoneyStays() {
        Plan p=create();long id=institute();Subscription sub=assign(id,p,"ACTIVE",null,null,"Assign");
        jdbc.update("insert into platform_invoices(institute_id,subscription_id,invoice_number,amount,tax,total_amount,due_date,status) values (?,?,?,2999,0,2999,current_date,'PENDING')",id,sub.id(),code());
        assertFalse(entitlements.hasFeature(id,FeatureCode.LIBRARY));
        service.savePlan(edit(p,new BigDecimal("5999"),List.of("FEES","LIBRARY")),actor,request);
        assertTrue(entitlements.hasFeature(id,FeatureCode.LIBRARY));
        jdbc.update("insert into institute_feature_overrides(institute_id,feature_code,enabled,reason,updated_by_platform_user_id) values (?,'LIBRARY',false,'Override',1)",id);
        assertFalse(entitlements.hasFeature(id,FeatureCode.LIBRARY));
        assertEquals(0,sub.amount().compareTo(service.subscriptions(id).get(0).amount()));
        assertEquals(0,new BigDecimal("2999").compareTo(jdbc.queryForObject("select amount from platform_invoices where subscription_id=?",BigDecimal.class,sub.id())));
    }
    @Test void deactivationPreservesSubscribersAndDefaultPlanIsProtected() {
        Plan p=create();long id=institute();assign(id,p,"ACTIVE",null,null,"Assign");
        Plan inactive=service.changePlanStatus(p.id(),new PlanStatus("INACTIVE",p.version(),"Deactivate"),actor,request);
        assertTrue(entitlements.hasFeature(id,FeatureCode.FEES));
        error("PLAN_INACTIVE",()->assign(institute(),inactive,"ACTIVE",null,null,"Assign"));
        service.changePlanStatus(p.id(),new PlanStatus("ACTIVE",inactive.version(),"Activate"),actor,request);
        Plan def=service.plans().stream().filter(x->x.code().equals("BASIC")).findFirst().orElseThrow();
        error("DEFAULT_PLAN_CANNOT_BE_DEACTIVATED",()->service.changePlanStatus(def.id(),new PlanStatus("INACTIVE",def.version(),"Deactivate"),actor,request));
    }
    @Test void assignmentsSnapshotPricesRequireOverrideReasonAndPreserveHistory() {
        Plan p=create();long id=institute();
        error("SUBSCRIPTION_PRICE_OVERRIDE_REASON_REQUIRED",()->assign(id,p,"ACTIVE",null,BigDecimal.ONE,""));
        Subscription first=assign(id,p,"ACTIVE",null,BigDecimal.ONE,"Negotiated price");
        assertEquals(1,jdbc.queryForObject("select count(*) from platform_audit_logs where action='SUBSCRIPTION_PRICE_OVERRIDE' and target_institute_id=?",Integer.class,id));
        Subscription second=assign(id,p,"ACTIVE",first,null,"Renew");
        assertEquals(2,service.subscriptions(id).size());assertEquals("CANCELLED",service.subscriptions(id).get(1).status());
        assertEquals(second.id(),service.subscriptions(id).get(0).id());
        error("SUBSCRIPTION_CONFLICT",()->assign(id,p,"ACTIVE",first,null,"Stale"));
    }
    @Test void concurrentAssignmentsLeaveOnlyOneCurrentAndRejectStaleRequest() throws Exception {
        Plan p=create();long id=institute();Subscription first=assign(id,p,"ACTIVE",null,null,"Assign");
        var start=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
        Callable<String> work=()->{start.await();try{assign(id,p,"ACTIVE",first,null,"Concurrent");return "OK";}catch(ResponseStatusException ex){return ex.getReason();}};
        try {var a=executor.submit(work);var b=executor.submit(work);start.countDown();assertEquals(Set.of("OK","SUBSCRIPTION_CONFLICT"),Set.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS)));}
        finally{executor.shutdownNow();}
        assertEquals(1,jdbc.queryForObject("select count(*) from institute_subscriptions where institute_id=? and status in ('ACTIVE','TRIAL','PAST_DUE')",Integer.class,id));
    }
    @Test void trialExtensionConversionEndingAndRequestTimeExpiry() {
        Plan p=create();long id=institute();Subscription trial=assign(id,p,"TRIAL",null,null,"Trial");assertEquals(0,trial.amount().signum());
        Subscription extended=service.extendTrial(id,new TrialExtension(trial.endDate().plusDays(5),"Extension",trial.version()),actor,request);
        assertEquals(trial.id(),extended.id());assertEquals(trial.version()+1,extended.version());
        assertEquals(1,jdbc.queryForObject("select count(*) from platform_audit_logs where action='TRIAL_EXTENDED' and target_institute_id=?",Integer.class,id));
        Subscription paid=assign(id,p,"ACTIVE",extended,null,"Convert");assertEquals(0,paid.amount().compareTo(p.monthlyPrice()));
        long other=institute();Subscription otherTrial=assign(other,p,"TRIAL",null,null,"Trial");service.endTrial(other,new StatusChange("End",otherTrial.version()),actor,request);assertFalse(entitlements.hasFeature(other,FeatureCode.FEES));
        jdbc.update("update institute_subscriptions set start_date=current_date-20,end_date=current_date-1 where id=?",paid.id());
        assertFalse(entitlements.hasFeature(id,FeatureCode.FEES));
        context.getBean(SubscriptionExpiryJob.class).expireEndedSubscriptions();
        assertEquals("EXPIRED",service.subscriptions(id).get(0).status());
        var audit=service.audits(0,25,id,"SUBSCRIPTION_EXPIRED",null,"",null,null).content();
        assertEquals("System",audit.get(0).actor());assertNull(audit.get(0).platformUserId());
        assertThrows(ResponseStatusException.class,()->tx.execute(st->{limits.assertCanAdd(id,PlanLimitService.Resource.STUDENTS,1);return null;}));
        assertEquals(1,jdbc.queryForObject("select count(*) from institutes where id=?",Integer.class,id));
    }
    @Test void limitsDowngradesAndInactiveUsers() {
        Plan p=service.savePlan(payload(code(),BigDecimal.ZERO,1,List.of()),actor,request);long id=institute();assign(id,p,"ACTIVE",null,null,"Assign");
        jdbc.update("insert into students(institute_id,status) values (?,'Verified'),(?,'Archived')",id,id);
        assertThrows(IllegalArgumentException.class,()->tx.execute(st->{limits.assertCanAdd(id,PlanLimitService.Resource.STUDENTS,1);return null;}));
        jdbc.update("insert into teachers(institute_id,status) select ?,'Active' from generate_series(1,50)",id);
        assertThrows(IllegalArgumentException.class,()->tx.execute(st->{limits.assertCanAdd(id,PlanLimitService.Resource.TEACHERS,1);return null;}));
        jdbc.update("insert into user_accounts(institute_id,status) select ?,'INACTIVE' from generate_series(1,120)",id);
        tx.execute(st->{limits.assertCanAdd(id,PlanLimitService.Resource.USERS,100);return null;});
        jdbc.update("insert into user_accounts(institute_id,status) select ?,'ACTIVE' from generate_series(1,100)",id);
        assertThrows(IllegalArgumentException.class,()->tx.execute(st->{limits.assertCanAdd(id,PlanLimitService.Resource.USERS,1);return null;}));
        Plan zero=service.savePlan(payload(code(),BigDecimal.ZERO,0,List.of()),actor,request);assign(id,zero,"ACTIVE",service.subscriptions(id).get(0),null,"Downgrade");
        assertEquals(2,jdbc.queryForObject("select count(*) from students where institute_id=?",Integer.class,id));
        assertEquals("OVER_LIMIT",service.usageDirectory(0,25,"","OVER_LIMIT").content().stream().filter(x->x.instituteId()==id).findFirst().orElseThrow().limitStatus());
    }
    @Test void defaultRegistrationAndDirectoryFiltersUseCurrentOnly() {
        Plan p=create();String old=jdbc.queryForObject("select setting_value from platform_settings where setting_key='defaultPlan'",String.class);
        try {
            service.updateSettings(new SettingsUpdate("15",p.code(),null,null,null,"Default"),actor,request);
            long id=institute();context.getBean(PlatformProvisioningService.class).provisionTrial(id);
            Subscription trial=service.subscriptions(id).get(0);assertEquals(p.id(),trial.planId());assertEquals(LocalDate.now().plusDays(15),trial.endDate());
            assertEquals(1,service.subscriptionDirectory(0,25,"","TRIAL",p.code(),"CUSTOM",LocalDate.now(),LocalDate.now().plusDays(30),30).totalElements());
            assign(id,p,"ACTIVE",trial,null,"Convert");
            assertEquals(0,service.subscriptionDirectory(0,25,"","TRIAL",p.code()).totalElements());
            assertEquals(1,service.subscriptionDirectory(0,25,"","ACTIVE",p.code()).totalElements());
            assertNotNull(service.subscriptionSummary());
        } finally {jdbc.update("update platform_settings set setting_value=? where setting_key='defaultPlan'",old);}
    }
    @Test void paginatedReadsHaveBoundedQueryCountsAndNoEntityPreload() {
        java.util.List<String> queries=new java.util.ArrayList<>();
        var counted=new org.springframework.jdbc.datasource.DelegatingDataSource(jdbc.getDataSource()) {
            @Override public java.sql.Connection getConnection() throws java.sql.SQLException {
                var connection=super.getConnection();
                return (java.sql.Connection)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{java.sql.Connection.class},(proxy,method,args)->{
                    if(method.getName().equals("prepareStatement") || method.getName().equals("createStatement")) {
                        if(args!=null && args.length>0 && args[0] instanceof String sql) queries.add(sql);
                        else queries.add("statement");
                    }
                    try{return method.invoke(connection,args);}catch(java.lang.reflect.InvocationTargetException ex){throw ex.getCause();}
                });
            }
        };
        var template=new JdbcTemplate(counted);
        var reads=new PlatformConsoleService(template,new NamedParameterJdbcTemplate(template),context.getBean(PlatformAuditService.class));
        reads.plans();assertEquals(2,queries.size());
        queries.clear();reads.subscriptionSummary();assertEquals(1,queries.size());
        queries.clear();reads.subscriptionDirectory(0,25,"","","","",null,null,null);assertEquals(2,queries.size());
        assertTrue(queries.stream().noneMatch(q->q.contains("from students") || q.contains("from teachers") || q.contains("platform_invoices")));
    }

    @Test void concurrentAdmissionsRespectCapacity() throws Exception {
        Plan p=service.savePlan(payload(code(),BigDecimal.ZERO,1,List.of()),actor,request);long id=institute();assign(id,p,"ACTIVE",null,null,"Assign");
        var start=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
        Callable<Boolean> work=()->{start.await();try {return tx.execute(st->{limits.assertCanAdd(id,PlanLimitService.Resource.STUDENTS,1);jdbc.update("insert into students(institute_id,status) values (?,'Verified')",id);return true;});}catch(IllegalArgumentException ex){assertTrue(ex.getMessage().startsWith("PLAN_STUDENT_LIMIT_REACHED"));return false;}};
        try {var a=executor.submit(work);var b=executor.submit(work);start.countDown();assertNotEquals(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));}finally{executor.shutdownNow();}
        assertEquals(1,jdbc.queryForObject("select count(*) from students where institute_id=?",Integer.class,id));
    }

    @Test void merchantHistoryMigrationKeepsOneCurrentAndDirectoryTracksOnlyCurrent() {
        long id=institute();
        Long old=jdbc.queryForObject("insert into cashfree_merchant_accounts(institute_id,merchant_id,onboarding_status,payments_enabled,created_at,updated_at) values (?,?,'ACTIVE',true,now(),now()) returning id",Long.class,id,code());
        jdbc.update("update cashfree_merchant_accounts set is_current=false where id=?",old);
        String next=code();
        jdbc.update("insert into cashfree_merchant_accounts(institute_id,merchant_id,onboarding_status,payments_enabled,created_at,updated_at) values (?,?,'ACTIVE',true,now(),now())",id,next);
        jdbc.update("update cashfree_merchant_accounts set onboarding_status='REJECTED',payments_enabled=false where id=?",old);
        assertEquals(next,jdbc.queryForObject("select external_account_id from institute_payment_gateway_accounts where institute_id=?",String.class,id));
        assertEquals(2,jdbc.queryForObject("select count(*) from cashfree_merchant_accounts where institute_id=?",Integer.class,id));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("update cashfree_merchant_accounts set is_current=true where id=?",old));
    }

}
