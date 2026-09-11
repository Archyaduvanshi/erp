package com.erp.backend.platform.controller;

import static com.erp.backend.platform.dto.PlatformDtos.*;

import java.time.LocalDate;
import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.institute.dto.InstituteResponse;
import com.erp.backend.institute.dto.RegisterInstituteRequest;
import com.erp.backend.institute.service.InstituteService;
import com.erp.backend.platform.FeatureCode;
import com.erp.backend.platform.service.PlatformAuditService;
import com.erp.backend.platform.service.PlatformConsoleService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class PlatformController {
    private final PlatformConsoleService service;
    private final InstituteService instituteService;
    private final PlatformAuditService auditService;

    public PlatformController(PlatformConsoleService service, InstituteService instituteService, PlatformAuditService auditService) {
        this.service = service;
        this.instituteService = instituteService;
        this.auditService = auditService;
    }

    @GetMapping("/overview")
    public Overview overview() { return service.overview(); }

    @GetMapping("/institutes")
    public PageResponse<InstituteRow> institutes(
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,
            @RequestParam(defaultValue="") String search,@RequestParam(defaultValue="") String status,
            @RequestParam(defaultValue="") String type,@RequestParam(defaultValue="") String plan,
            @RequestParam(defaultValue="") String state,@RequestParam(defaultValue="") String city,
            @RequestParam(defaultValue="") String subscriptionStatus,@RequestParam(defaultValue="") String paymentGatewayStatus,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate registeredFrom,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate registeredTo,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate expiryFrom,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate expiryTo,
            @RequestParam(defaultValue="registeredAt") String sort,@RequestParam(defaultValue="desc") String direction
    ) { return service.institutes(page,size,search,status,type,plan,state,city,subscriptionStatus,paymentGatewayStatus,registeredFrom,registeredTo,expiryFrom,expiryTo,sort,direction); }

    @PostMapping("/institutes")
    @Transactional
    public InstituteResponse createInstitute(@Valid @RequestBody RegisterInstituteRequest payload,
                                             @AuthenticationPrincipal AuthPrincipal actor, HttpServletRequest request) {
        InstituteResponse institute = instituteService.createInstituteFromPlatform(payload);
        auditService.record(actor.accountId(), "INSTITUTE_CREATED", "INSTITUTE", String.valueOf(institute.getId()), institute.getId(),
                null, institute, "Created by platform administrator", request.getRemoteAddr(), request.getHeader("User-Agent"));
        return institute;
    }

    @GetMapping("/institutes/{id}")
    public InstituteDetail institute(@PathVariable Long id) { return service.institute(id); }

    @PostMapping("/institutes/{id}/suspend")
    public InstituteDetail suspend(@PathVariable Long id,@Valid @RequestBody StatusChange payload,
                                   @AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.changeInstituteStatus(id,"SUSPENDED",payload,actor,request);
    }

    @PostMapping("/institutes/{id}/reactivate")
    public InstituteDetail reactivate(@PathVariable Long id,@Valid @RequestBody StatusChange payload,
                                      @AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.changeInstituteStatus(id,"ACTIVE",payload,actor,request);
    }

    @GetMapping("/institutes/{id}/features")
    public List<FeatureAccess> features(@PathVariable Long id) { return service.features(id); }

    @PutMapping("/institutes/{id}/features")
    public FeatureAccess feature(@PathVariable Long id,@Valid @RequestBody FeatureUpdate payload,
                                 @AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.updateFeature(id,payload,actor,request);
    }

    @GetMapping({"/feature-registry", "/features/options"})
    public List<FeatureCode.FeatureDefinition> registry() { return FeatureCode.registry(); }

    @GetMapping("/features")
    public PageResponse<FeatureInstituteRow> featureDirectory(@RequestParam(defaultValue="0") int page,
                                                               @RequestParam(defaultValue="25") int size,
                                                               @RequestParam(defaultValue="") String search,
                                                               @RequestParam(defaultValue="") String status) {
        return service.featureDirectory(page,size,search,status);
    }

    @GetMapping("/plans")
    public List<Plan> plans() { return service.plans(); }

    @PostMapping("/plans")
    public Plan savePlan(@Valid @RequestBody PlanPayload payload,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        if(payload.id()!=null) throw new IllegalArgumentException("Use PUT /plans/{id} to edit a plan.");
        return service.savePlan(payload,actor,request);
    }

    @PutMapping("/plans/{id}")
    public Plan updatePlan(@PathVariable Long id,@Valid @RequestBody PlanPayload p,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.savePlan(new PlanPayload(id,p.code(),p.name(),p.monthlyPrice(),p.yearlyPrice(),p.maxStudents(),p.maxTeachers(),p.maxUsers(),p.maxStorageMb(),p.trialDays(),p.status(),p.features(),p.version(),p.reason()),actor,request);
    }

    @PutMapping("/plans/{id}/status")
    public Plan planStatus(@PathVariable Long id,@Valid @RequestBody PlanStatus p,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.changePlanStatus(id,p,actor,request);
    }

    @GetMapping("/subscriptions/summary")
    public SubscriptionSummary subscriptionSummary() { return service.subscriptionSummary(); }

    @PostMapping("/institutes/{id}/subscriptions/extend-trial")
    public Subscription extendTrial(@PathVariable Long id,@Valid @RequestBody TrialExtension p,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.extendTrial(id,p,actor,request);
    }

    @PostMapping("/institutes/{id}/subscriptions/end-trial")
    public Subscription endTrial(@PathVariable Long id,@Valid @RequestBody StatusChange p,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.endTrial(id,p,actor,request);
    }

    @GetMapping("/institutes/{id}/subscriptions")
    public List<Subscription> subscriptions(@PathVariable Long id) { return service.subscriptions(id); }

    @PostMapping("/institutes/{id}/subscriptions")
    public Subscription changeSubscription(@PathVariable Long id,@Valid @RequestBody SubscriptionChange payload,
                                           @AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.changeSubscription(id,payload,actor,request);
    }

    @GetMapping("/subscriptions")
    public PageResponse<SubscriptionRow> subscriptionDirectory(@RequestParam(defaultValue="0") int page,
                                                                @RequestParam(defaultValue="25") int size,
                                                                @RequestParam(defaultValue="") String search,
                                                                @RequestParam(defaultValue="") String status,
                                                                @RequestParam(defaultValue="") String plan,
                                                                @RequestParam(defaultValue="") String billingCycle,
                                                                @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate expiryFrom,
                                                                @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate expiryTo,
                                                                @RequestParam(required=false) Integer expiringDays) {
        return service.subscriptionDirectory(page,size,search,status,plan,billingCycle,expiryFrom,expiryTo,expiringDays);
    }

    @GetMapping("/institutes/{id}/usage")
    public Usage usage(@PathVariable Long id) { return service.usage(id); }

    @GetMapping("/usage/overview")
    public UsageOverview usageOverview() { return service.usageOverview(); }

    @GetMapping("/usage")
    public PageResponse<UsageRow> usageDirectory(@RequestParam(defaultValue="0") int page,
                                                  @RequestParam(defaultValue="25") int size,
                                                  @RequestParam(defaultValue="") String search,
                                                  @RequestParam(defaultValue="") String limitStatus) {
        return service.usageDirectory(page,size,search,limitStatus);
    }

    @GetMapping("/institutes/{id}/gateway")
    public Gateway gateway(@PathVariable Long id) { return service.gateway(id); }

    @GetMapping("/gateways")
    public PageResponse<GatewayRow> gateways(@RequestParam(defaultValue="0") int page,
                                              @RequestParam(defaultValue="25") int size,
                                              @RequestParam(defaultValue="") String search,
                                              @RequestParam(defaultValue="") String provider,
                                              @RequestParam(defaultValue="") String status) {
        return service.gateways(page,size,search,provider,status);
    }

    @GetMapping("/billing")
    public PageResponse<Invoice> invoices(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,
                                          @RequestParam(required=false) Long instituteId,@RequestParam(defaultValue="") String status,
                                          @RequestParam(defaultValue="") String search,
                                          @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate dueFrom,
                                          @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate dueTo) {
        return service.invoices(page,size,instituteId,status,search,dueFrom,dueTo);
    }

    @PostMapping("/billing")
    public Invoice createInvoice(@Valid @RequestBody InvoicePayload payload,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.createInvoice(payload,actor,request);
    }

    @PostMapping("/billing/{id}/mark-paid")
    public Invoice markPaid(@PathVariable Long id,@Valid @RequestBody InvoiceStatusChange payload,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.changeInvoiceStatus(id,"PAID",payload,actor,request);
    }

    @PostMapping("/billing/{id}/waive")
    public Invoice waive(@PathVariable Long id,@Valid @RequestBody InvoiceStatusChange payload,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.changeInvoiceStatus(id,"WAIVED",payload,actor,request);
    }

    @PostMapping("/billing/{id}/cancel")
    public Invoice cancelInvoice(@PathVariable Long id,@Valid @RequestBody InvoiceStatusChange payload,@AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.changeInvoiceStatus(id,"CANCELLED",payload,actor,request);
    }

    @GetMapping("/institutes/{id}/notes")
    public List<InternalNote> notes(@PathVariable Long id) { return service.notes(id); }

    @PostMapping("/institutes/{id}/notes")
    public InternalNote addNote(@PathVariable Long id,@Valid @RequestBody NotePayload payload,
                                @AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.addNote(id,payload,actor,request);
    }

    @GetMapping("/audit")
    public PageResponse<AuditRow> audit(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,
                                        @RequestParam(required=false) Long instituteId,@RequestParam(defaultValue="") String action,
                                        @RequestParam(required=false) Long actorId,@RequestParam(defaultValue="") String targetType,
                                        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
                                        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.audits(page,size,instituteId,action,actorId,targetType,from,to);
    }

    @GetMapping("/settings")
    public List<PlatformSetting> settings() { return service.settings(); }

    @PutMapping("/settings")
    public List<PlatformSetting> updateSettings(@Valid @RequestBody SettingsUpdate payload,
                                                @AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        return service.updateSettings(payload,actor,request);
    }
}
