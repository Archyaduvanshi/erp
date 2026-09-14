package com.erp.backend.publicsite;

import com.erp.backend.auth.OtpEmailDeliveryService;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PublicDatabaseTest {
    @Configuration @EnableTransactionManagement static class TransactionConfiguration {}
    private JdbcTemplate jdbc,admin;
    private AnnotationConfigApplicationContext context;
    private String schema;
    private PublicCatalogService catalog;
    private PublicRateLimitService limiter;
    private DemoRequestService demos;

    @BeforeAll void setup() throws Exception {
        Properties env=new Properties();
        if(Files.exists(Path.of(".env"))) try(var reader=Files.newBufferedReader(Path.of(".env"))) { env.load(reader); }
        String url=env.getProperty("SPRING_DATASOURCE_URL", "jdbc:postgresql://localhost:5432/erp_db");
        // Tests never point to a remote/deployed database.
        Assumptions.assumeTrue(url.startsWith("jdbc:postgresql://localhost:") || url.startsWith("jdbc:postgresql://127.0.0.1:"));
        String user=env.getProperty("SPRING_DATASOURCE_USERNAME","postgres"), password=env.getProperty("SPRING_DATASOURCE_PASSWORD","");
        admin=new JdbcTemplate(new DriverManagerDataSource(url,user,password));
        schema="landing_test_"+UUID.randomUUID().toString().replace("-","");
        admin.execute("create schema "+schema);
        var source=new DriverManagerDataSource(url+(url.contains("?")?"&":"?")+"currentSchema="+schema,user,password);
        jdbc=new JdbcTemplate(source);
        jdbc.execute("create table platform_settings(setting_key text primary key,setting_value text not null)");
        jdbc.execute("create table subscription_plans(id bigint primary key,code text,name text,monthly_price numeric,yearly_price numeric,trial_days int,max_students int,max_teachers int,status text)");
        jdbc.execute("create table subscription_plan_features(plan_id bigint,feature_code text)");
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V49__public_landing_and_demo_requests.sql")));
        context=new AnnotationConfigApplicationContext(); context.register(TransactionConfiguration.class);
        context.registerBean(JdbcTemplate.class,()->jdbc);
        context.registerBean(DataSourceTransactionManager.class,()->new DataSourceTransactionManager(source));
        context.register(PublicCatalogService.class,PublicRateLimitService.class,DemoRequestService.class);
        context.refresh(); catalog=context.getBean(PublicCatalogService.class); limiter=context.getBean(PublicRateLimitService.class); demos=context.getBean(DemoRequestService.class);
    }

    @AfterAll void cleanup() {
        if(context!=null) context.close();
        if(admin!=null && schema!=null && schema.matches("landing_test_[a-f0-9]{32}")) admin.execute("drop schema "+schema+" cascade");
    }

    @Test void actualQueriesExposeOnlyActivePlansAndSafeContactSettings() {
        jdbc.update("insert into subscription_plans values(1,'ACTIVE','Starter',900,9000,14,200,20,'ACTIVE'),(2,'HIDDEN','Hidden',0,0,14,1,1,'INACTIVE')");
        jdbc.update("insert into subscription_plan_features values(1,'STUDENT_MANAGEMENT'),(1,'LIVE_TRANSPORT_TRACKING'),(1,'SECRET_FEATURE'),(2,'FEES')");
        var result=catalog.plans(); assertEquals(1,result.size()); assertEquals("Starter",result.get(0).name());
        assertEquals(List.of("Student Management"),result.get(0).features());
        jdbc.update("insert into platform_settings values('platformSupportEmail','support@example.test'),('registrationEnabled','false'),('privateKey','never public')");
        assertFalse(catalog.config().registrationEnabled()); assertEquals("support@example.test",catalog.config().supportEmail());
    }

    @Test void rateLimitIsAtomicAcrossConcurrentRequestsAndRejectsTheSixth() throws Exception {
        String key=UUID.randomUUID().toString();
        AtomicInteger accepted=new AtomicInteger();
        var pool=Executors.newFixedThreadPool(8);
        try {
            var futures=new ArrayList<Future<?>>();
            for(int i=0;i<12;i++) futures.add(pool.submit(()-> { try { limiter.check("concurrent",key,5,Duration.ofHours(1)); accepted.incrementAndGet(); } catch(ResponseStatusException e) { assertEquals(429,e.getStatusCode().value()); } }));
            for(var future:futures) future.get(20,TimeUnit.SECONDS);
            assertEquals(5,accepted.get());
            assertThrows(ResponseStatusException.class,()->limiter.check("concurrent",key,5,Duration.ofHours(1)));
        } finally { pool.shutdownNow(); }
    }

    @Test void demoPersistsAndNotificationCanBeRetriedWithoutLosingRequest() {
        demos.submit(new PublicDtos.DemoRequest("Visitor","Demo school","test@example.test","1234567890","School","City",150,"Attendance please","",System.currentTimeMillis()-5000));
        var row=jdbc.queryForMap("select status,created_at,notification_status from public_demo_requests");
        assertEquals("NEW",row.get("status")); assertNotNull(row.get("created_at")); assertEquals("PENDING",row.get("notification_status"));
        var mail=mock(OtpEmailDeliveryService.class);
        var safeCatalog=mock(PublicCatalogService.class);
        when(safeCatalog.config()).thenReturn(new PublicDtos.Config("support@example.test","",true));
        doThrow(new IllegalStateException("mail offline")).when(mail).send(anyString(),anyString(),anyString());
        new DemoNotificationJob(jdbc,safeCatalog,mail).deliverNext();
        assertEquals(1,jdbc.queryForObject("select notification_attempts from public_demo_requests",Integer.class));
        assertEquals("PENDING",jdbc.queryForObject("select notification_status from public_demo_requests",String.class));
        jdbc.update("update public_demo_requests set next_notification_at=now()"); reset(mail);
        new DemoNotificationJob(jdbc,safeCatalog,mail).deliverNext();
        assertEquals("SENT",jdbc.queryForObject("select notification_status from public_demo_requests",String.class));
    }
}
