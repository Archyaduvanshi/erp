package com.erp.backend.platform;

import com.erp.backend.cashfree.*;
import com.erp.backend.cashfree.dto.CashfreeDtos.LinkMerchantRequest;
import com.erp.backend.cashfree.entity.CashfreeMerchantAccount;
import com.erp.backend.cashfree.entity.CashfreePaymentAttempt;
import com.erp.backend.cashfree.repository.*;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.fee.service.FeeService;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CashfreeMerchantLinkTest {
    private CashfreePaymentService service;
    private CashfreeMerchantAccountRepository merchants;
    private CashfreePartnerClient client;
    private CashfreePaymentAttemptRepository attempts;
    private Institute school;
    private final ObjectMapper mapper=new ObjectMapper();

    @BeforeEach void setup() {
        merchants=mock(CashfreeMerchantAccountRepository.class);client=mock(CashfreePartnerClient.class);
        attempts=mock(CashfreePaymentAttemptRepository.class);
        var institutes=mock(InstituteRepository.class);
        school=new Institute();school.setId(1L);
        when(institutes.findByIdForGatewayUpdate(1L)).thenReturn(Optional.of(school));
        service=new CashfreePaymentService(mock(CashfreePartnerProperties.class),client,mapper,institutes,
                mock(StudentRepository.class),mock(AcademicSessionRepository.class),merchants,attempts,mock(CashfreeWebhookEventRepository.class),mock(FeeService.class));
        when(merchants.saveAndFlush(any())).thenAnswer(call->{CashfreeMerchantAccount a=call.getArgument(0);if(a.getId()==null)a.setId(20L);a.setVersion(a.getVersion()+1);return a;});
    }
    private CashfreeMerchantAccount old() {
        var a=new CashfreeMerchantAccount();a.setId(10L);a.setInstitute(school);a.setMerchantId("old_merchant");a.setVersion(2L);
        when(merchants.findByInstituteId(1L)).thenReturn(Optional.of(a));return a;
    }
    private LinkMerchantRequest request(){return new LinkMerchantRequest("new_merchant",10L,2L,"Correct school account",true);}
    private void verified(){when(client.getMerchant("new_merchant")).thenReturn(mapper.createObjectNode().put("merchant_id","new_merchant").put("payments_enabled",true).put("onboarding_status","ACTIVE"));}

    @Test void replacementPreservesHistoricalAccountAndOldOrderRouting() {
        var old=old();verified();var order=new CashfreePaymentAttempt();order.setMerchantAccount(old);order.setOrderId("order_1");
        var result=service.linkMerchant(1L,request());
        assertEquals("new_merchant",result.merchantId());assertTrue(result.paymentsEnabled());assertFalse(old.isCurrent());
        assertEquals("old_merchant",order.getMerchantAccount().getMerchantId());
        verify(merchants,never()).delete(any());verifyNoInteractions(attempts);
    }
    @Test void firstExistingMerchantCanBeLinkedWithoutCreatingRemoteMerchant() {
        verified();var result=service.linkMerchant(1L,new LinkMerchantRequest("new_merchant",null,null,"Existing sandbox account",true));
        assertEquals("new_merchant",result.merchantId());verify(client,never()).createMerchant(any());
    }
    @Test void partnerLookupFailureDoesNotDeactivateCurrentAccount() {
        var old=old();when(client.getMerchant("new_merchant")).thenThrow(new IllegalArgumentException("Merchant not found"));
        assertThrows(IllegalArgumentException.class,()->service.linkMerchant(1L,request()));assertTrue(old.isCurrent());verify(merchants,never()).saveAndFlush(any());
    }
    @Test void differentSchoolAndStaleRequestsAreRejected() {
        old();var other=new Institute();other.setId(2L);var linked=new CashfreeMerchantAccount();linked.setInstitute(other);
        when(merchants.findByMerchantId("new_merchant")).thenReturn(Optional.of(linked));
        assertEquals("MERCHANT_ALREADY_LINKED_TO_ANOTHER_INSTITUTE",assertThrows(ResponseStatusException.class,()->service.linkMerchant(1L,request())).getReason());
        assertEquals("GATEWAY_MODIFIED_CONCURRENTLY",assertThrows(ResponseStatusException.class,()->service.linkMerchant(1L,new LinkMerchantRequest("new_merchant",10L,1L,"Stale",true))).getReason());
        verifyNoInteractions(client);
    }
    @Test void switchingBackReusesOwnHistoricalAccount() {
        var old=old();var previous=new CashfreeMerchantAccount();previous.setId(20L);previous.setInstitute(school);previous.setMerchantId("new_merchant");previous.setCurrent(false);
        when(merchants.findByMerchantId("new_merchant")).thenReturn(Optional.of(previous));verified();
        var result=service.linkMerchant(1L,request());assertEquals(20L,result.accountId());assertTrue(previous.isCurrent());assertFalse(old.isCurrent());
    }
    @Test void mismatchedProviderResponseAndMissingConfirmationAreRejected() {
        var old=old();when(client.getMerchant("new_merchant")).thenReturn(mapper.createObjectNode().put("merchant_id","different"));
        assertThrows(IllegalArgumentException.class,()->service.linkMerchant(1L,request()));assertTrue(old.isCurrent());
        assertThrows(IllegalArgumentException.class,()->service.linkMerchant(1L,new LinkMerchantRequest("new_merchant",10L,2L,"Change",false)));
    }
}
