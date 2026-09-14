package com.erp.backend.publicsite;

import com.erp.backend.auth.ClientIpResolver;
import com.erp.backend.auth.OtpEmailDeliveryService;
import com.erp.backend.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PublicSiteTest {
    private PublicDtos.DemoRequest valid() {
        return new PublicDtos.DemoRequest("Visitor", "Example school", "visitor@example.test", "+91 9876543210", "School", "", 200, "Show attendance", "", System.currentTimeMillis()-5000);
    }

    @Test void publicDtosHaveOnlyApprovedFieldsAndUnknownFeaturesStayPrivate() throws Exception {
        var mapper=new ObjectMapper();
        var fields=mapper.valueToTree(new PublicDtos.Plan("Basic","BASIC",java.math.BigDecimal.ONE,java.math.BigDecimal.TEN,14,100,10,List.of("Attendance")));
        assertEquals(8,fields.size());
        for(String field:List.of("id","version","createdAt","status","maxStorageMb")) assertFalse(fields.has(field));
        assertEquals(3,mapper.valueToTree(new PublicDtos.Config("","",false)).size());
        assertNull(PublicCatalogService.publicFeature("LIVE_TRANSPORT_TRACKING"));
        assertNull(PublicCatalogService.publicFeature("INTERNAL_SECRET"));
        assertEquals("Student Management",PublicCatalogService.publicFeature("STUDENT_MANAGEMENT"));
    }

    @Test void validationRejectsMissingFieldsAndOversizedMessages() {
        try(var factory=Validation.buildDefaultValidatorFactory()) {
            var validator=factory.getValidator();
            assertTrue(validator.validate(valid()).isEmpty());
            assertFalse(validator.validate(new PublicDtos.DemoRequest("", "", "invalid", "abc", "Invalid", "", 0, "x".repeat(2001), "", null)).isEmpty());
        }
    }

    @Test void controllerValidatesBeforeSavingAndDoesNotExposeDemoListing() throws Exception {
        var catalog=mock(PublicCatalogService.class);
        var demos=mock(DemoRequestService.class);
        var mvc=MockMvcBuilders.standaloneSetup(new PublicController(catalog,demos)).setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(post("/api/public/demo-requests").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.email").exists());
        verifyNoInteractions(demos);
        mvc.perform(post("/api/public/demo-requests").contentType("application/json").content(new ObjectMapper().writeValueAsString(valid())))
                .andExpect(status().isAccepted());
        verify(demos).submit(any());
        mvc.perform(get("/api/public/demo-requests")).andExpect(status().isMethodNotAllowed());
    }

    @Test void honeypotIsIgnoredAndHtmlAndShortPhoneAreRejected() {
        var jdbc=mock(JdbcTemplate.class);
        var limiter=mock(PublicRateLimitService.class);
        var service=new DemoRequestService(jdbc,limiter);
        var request=valid();
        service.submit(new PublicDtos.DemoRequest(request.name(),request.instituteName(),request.email(),request.phone(),request.instituteType(),"",200,"","bot.example",request.startedAt()));
        verifyNoInteractions(jdbc,limiter);
        assertThrows(ResponseStatusException.class,()->DemoRequestService.plain("<script>alert(1)</script>"));
        assertThrows(ResponseStatusException.class,()->service.submit(new PublicDtos.DemoRequest(request.name(),request.instituteName(),request.email(),"-------",request.instituteType(),"",200,"","",request.startedAt())));
        verifyNoInteractions(jdbc);
    }

    @Test void publicAllowlistIsMethodAndPathSpecific() {
        assertTrue(PublicRequestFilter.isPublicRequest("GET","/api/public/plans"));
        assertTrue(PublicRequestFilter.isPublicRequest("POST","/api/public/demo-requests"));
        assertTrue(PublicRequestFilter.isPublicRequest("POST","/api/institutes/register"));
        for(String path:List.of("/api/public/plans/1","/api/public/settings","/api/platform/plans","/api/students")) assertFalse(PublicRequestFilter.isPublicRequest("GET",path));
        assertFalse(PublicRequestFilter.isPublicRequest("DELETE","/api/public/plans"));
        assertFalse(PublicRequestFilter.isPublicRequest("GET","/api/public/demo-requests"));
    }

    @Test void throttlingRunsBeforeControllerAndReturnsRetryAfter() throws Exception {
        var limiter=mock(PublicRateLimitService.class);
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS)).when(limiter).check(anyString(),anyString(),anyInt(),any());
        var filter=new PublicRequestFilter(limiter,new ClientIpResolver(""));
        var request=new MockHttpServletRequest("POST","/api/public/demo-requests");
        request.setRemoteAddr("127.0.0.1");
        var response=new MockHttpServletResponse();
        filter.doFilter(request,response,(req,res)->fail("Rate-limited request must not reach controller"));
        assertEquals(429,response.getStatus());
        assertEquals("3600",response.getHeader("Retry-After"));
    }

    @Test void supportMailFailureKeepsRequestAndSchedulesRetry() {
        var jdbc=mock(JdbcTemplate.class);
        var catalog=mock(PublicCatalogService.class);
        var email=mock(OtpEmailDeliveryService.class);
        when(catalog.config()).thenReturn(new PublicDtos.Config("support@example.test","",true));
        when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("id",7L,"name","Visitor","institute_name","School","email","visitor@example.test","phone","1234567890","institute_type","School","city","City","approximate_students",200,"message","Demo")));
        doThrow(new IllegalStateException("mail offline")).when(email).send(anyString(),anyString(),anyString());
        assertDoesNotThrow(()->new DemoNotificationJob(jdbc,catalog,email).deliverNext());
        verify(email).send(eq("support@example.test"),eq("VidyantraErp demo request #7"),contains("visitor@example.test"));
        verify(jdbc).update(contains("notification_attempts>=4"),eq(7L));
        verify(jdbc,never()).update(contains("notification_status='SENT'"),eq(7L));
    }

    @Test void missingSupportAddressDoesNotDiscardEnquiries() {
        var jdbc=mock(JdbcTemplate.class);
        var catalog=mock(PublicCatalogService.class);
        var email=mock(OtpEmailDeliveryService.class);
        when(catalog.config()).thenReturn(new PublicDtos.Config("","",true));
        new DemoNotificationJob(jdbc,catalog,email).deliverNext();
        verifyNoInteractions(email);
        verify(jdbc,never()).queryForList(anyString());
    }
}
