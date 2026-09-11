package com.erp.backend.cashfree;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.net.URI;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.erp.backend.cashfree.dto.CashfreeDtos.AttemptResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.CreateOrderRequest;
import com.erp.backend.cashfree.dto.CashfreeDtos.MerchantResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.LinkMerchantRequest;
import com.erp.backend.cashfree.dto.CashfreeDtos.OrderResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.PaymentAvailabilityResponse;
import com.erp.backend.cashfree.entity.CashfreeMerchantAccount;
import com.erp.backend.cashfree.entity.CashfreePaymentAttempt;
import com.erp.backend.cashfree.entity.CashfreeWebhookEvent;
import com.erp.backend.cashfree.repository.CashfreeMerchantAccountRepository;
import com.erp.backend.cashfree.repository.CashfreePaymentAttemptRepository;
import com.erp.backend.cashfree.repository.CashfreeWebhookEventRepository;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.dto.FeePaymentResponse;
import com.erp.backend.fee.dto.FeeStudentSummaryResponse;
import com.erp.backend.fee.service.FeeService;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CashfreePaymentService {
    private final CashfreePartnerProperties properties;
    private final CashfreePartnerClient client;
    private final ObjectMapper objectMapper;
    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final CashfreeMerchantAccountRepository merchantRepository;
    private final CashfreePaymentAttemptRepository attemptRepository;
    private final CashfreeWebhookEventRepository webhookRepository;
    private final FeeService feeService;

    public CashfreePaymentService(
            CashfreePartnerProperties properties,
            CashfreePartnerClient client,
            ObjectMapper objectMapper,
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            AcademicSessionRepository academicSessionRepository,
            CashfreeMerchantAccountRepository merchantRepository,
            CashfreePaymentAttemptRepository attemptRepository,
            CashfreeWebhookEventRepository webhookRepository,
            FeeService feeService
    ) {
        this.properties = properties;
        this.client = client;
        this.objectMapper = objectMapper;
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.merchantRepository = merchantRepository;
        this.attemptRepository = attemptRepository;
        this.webhookRepository = webhookRepository;
        this.feeService = feeService;
    }

    @Transactional(readOnly = true)
    public MerchantResponse currentMerchant(Long instituteId) {
        return merchantRepository.findByInstituteId(instituteId)
                .map(a -> toMerchantResponse(a,null,null)).orElse(null);
    }

    @Transactional
    public MerchantResponse linkMerchant(Long instituteId, LinkMerchantRequest request) {
        properties.requireConfigured();
        Institute institute=lockInstitute(instituteId);
        String merchantId=request.merchantId()==null?"":request.merchantId().trim();
        if(!merchantId.matches("[A-Za-z0-9_-]{1,40}") || !request.confirmSchoolOwnership()
                || !StringUtils.hasText(request.reason()) || request.reason().trim().length()>500)
            throw new IllegalArgumentException("INVALID_MERCHANT_LINK: Merchant ID, ownership confirmation and reason are required.");
        CashfreeMerchantAccount current=merchantRepository.findByInstituteId(instituteId).orElse(null);
        if(!java.util.Objects.equals(request.expectedAccountId(),current==null?null:current.getId())
                || (current!=null && !java.util.Objects.equals(request.expectedVersion(),current.getVersion())))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"GATEWAY_MODIFIED_CONCURRENTLY");
        CashfreeMerchantAccount target=merchantRepository.findByMerchantId(merchantId).orElse(null);
        if(target!=null && !target.getInstitute().getId().equals(instituteId))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"MERCHANT_ALREADY_LINKED_TO_ANOTHER_INSTITUTE");
        // This lookup uses the configured partner key; arbitrary/unrelated Cashfree accounts cannot be linked.
        JsonNode verified=client.getMerchant(merchantId);
        if(!merchantId.equals(verified.path("merchant_id").asText()))
            throw new IllegalArgumentException("CASHFREE_MERCHANT_VERIFICATION_FAILED");
        if(target==null){target=new CashfreeMerchantAccount();target.setInstitute(institute);target.setMerchantId(merchantId);}
        if(current!=null && !current.getMerchantId().equals(merchantId)) {
            current.setCurrent(false);
            merchantRepository.saveAndFlush(current);
        }
        target.setCurrent(true);
        applyMerchantStatus(target,verified);
        try { return toMerchantResponse(merchantRepository.saveAndFlush(target),null,null); }
        catch(DataIntegrityViolationException ex) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"MERCHANT_LINK_CONFLICT",ex);
        }
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void lockMerchantConfiguration(Long instituteId) { lockInstitute(instituteId); }

    private Institute lockInstitute(Long instituteId) {
        return instituteRepository.findByIdForGatewayUpdate(instituteId)
                .orElseThrow(()->new ResourceNotFoundException("INSTITUTE_NOT_FOUND: Institute not found."));
    }

    @Transactional
    public MerchantResponse createMerchant(Long instituteId) {
        properties.requireConfigured();
        lockInstitute(instituteId);
        Optional<CashfreeMerchantAccount> existing = merchantRepository.findByInstituteId(instituteId);
        if (existing.isPresent()) return toMerchantResponse(existing.get(), null, null);

        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("INSTITUTE_NOT_FOUND: Institute not found."));
        String phone = normalizePhone(institute.getContact());
        String email = required(institute.getEmail(), "INSTITUTE_EMAIL_REQUIRED");
        String merchantId = buildMerchantId(institute);

        ObjectNode request = objectMapper.createObjectNode();
        request.put("merchant_id", merchantId);
        request.put("merchant_email", email.trim().toLowerCase(Locale.ROOT));
        request.put("merchant_name", required(institute.getInstituteName(), "INSTITUTE_NAME_REQUIRED"));
        request.put("poc_phone", phone);
        request.put("merchant_site_url", resolveMerchantSiteUrl(institute.getWebsite()));
        JsonNode response = client.createMerchant(request);

        CashfreeMerchantAccount account = new CashfreeMerchantAccount();
        account.setInstitute(institute);
        account.setMerchantId(text(response, "merchant_id", merchantId));
        applyMerchantStatus(account, response);
        return toMerchantResponse(merchantRepository.save(account), null, null);
    }

    @Transactional
    public MerchantResponse refreshMerchant(Long instituteId) {
        lockInstitute(instituteId);
        CashfreeMerchantAccount account = requireMerchant(instituteId);
        JsonNode response = client.getMerchant(account.getMerchantId());
        applyMerchantStatus(account, response);
        return toMerchantResponse(merchantRepository.save(account), null, null);
    }

    @Transactional
    public MerchantResponse createOnboardingLink(Long instituteId) {
        lockInstitute(instituteId);
        CashfreeMerchantAccount account = merchantRepository.findByInstituteId(instituteId)
                .orElseGet(() -> {
                    createMerchant(instituteId);
                    return requireMerchant(instituteId);
                });
        ObjectNode body = objectMapper.createObjectNode();
        body.put("type", "account_onboarding");
        body.put("return_url", properties.frontendBaseUrl() + "/platform/gateways?instituteId=" + instituteId);
        JsonNode response = client.createOnboardingLink(account.getMerchantId(), body);
        return toMerchantResponse(account, response.path("onboarding_link").asText(null), response.path("expires_at").asText(null));
    }

    @Transactional
    public OrderResponse createOrder(Long instituteId, Long studentId, CreateOrderRequest request) {
        lockInstitute(instituteId);
        properties.requireConfigured();
        String idempotencyKey = request.idempotencyKey().trim();
        Optional<CashfreePaymentAttempt> existing = attemptRepository
                .findByInstituteIdAndStudentIdAndIdempotencyKey(instituteId, studentId, idempotencyKey);
        if (existing.isPresent()) return toOrderResponse(existing.get());

        feeService.synchronizeChargesForStudent(instituteId, studentId);
        FeeStudentSummaryResponse summary = feeService.getMyStudentSummary(instituteId, studentId, request.academicSessionId());
        BigDecimal amount = money(request.amount());
        if (amount.compareTo(BigDecimal.ZERO) <= 0 || amount.compareTo(summary.totalOutstanding()) > 0) {
            throw new IllegalArgumentException("INVALID_PAYMENT_AMOUNT: Amount must be within the current outstanding fee.");
        }

        CashfreeMerchantAccount merchant = requireMerchant(instituteId);
        if (!merchant.isPaymentsEnabled()) {
            throw new IllegalArgumentException("CASHFREE_MERCHANT_NOT_ACTIVE: School payment account onboarding is not active.");
        }
        Student student = studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("STUDENT_NOT_FOUND: Student not found."));
        AcademicSession session = resolveSession(instituteId, request.academicSessionId());
        String orderId = "VDY-" + instituteId + "-" + studentId + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        CashfreePaymentAttempt attempt = new CashfreePaymentAttempt();
        attempt.setInstitute(student.getInstitute());
        attempt.setStudent(student);
        attempt.setAcademicSession(session);
        attempt.setMerchantAccount(merchant);
        attempt.setOrderId(orderId);
        attempt.setIdempotencyKey(idempotencyKey);
        attempt.setAmount(amount);
        attempt = attemptRepository.saveAndFlush(attempt);

        ObjectNode customer = objectMapper.createObjectNode();
        customer.put("customer_id", "STUDENT-" + student.getId());
        customer.put("customer_name", studentName(student));
        customer.put("customer_email", firstText(student.getEmail(), student.getInstitute().getEmail()));
        customer.put("customer_phone", normalizePhone(firstText(student.getMobile(), student.getGuardianPhone())));
        ObjectNode orderMeta = objectMapper.createObjectNode();
        orderMeta.put("return_url", properties.frontendBaseUrl() + "/student/fees?cashfree_order_id={order_id}");
        orderMeta.put("notify_url", properties.webhookUrl());
        ObjectNode body = objectMapper.createObjectNode();
        body.put("order_id", orderId);
        body.put("order_amount", amount);
        body.put("order_currency", "INR");
        body.set("customer_details", customer);
        body.set("order_meta", orderMeta);
        body.put("order_note", "VidyantraErp school fee payment");

        JsonNode response = client.createOrder(merchant.getMerchantId(), idempotencyKey, body);
        attempt.setCfOrderId(response.path("cf_order_id").asText(null));
        attempt.setPaymentSessionId(required(response.path("payment_session_id").asText(null), "CASHFREE_SESSION_MISSING"));
        attempt.setStatus(normalizeOrderStatus(response.path("order_status").asText("ACTIVE")));
        return toOrderResponse(attemptRepository.save(attempt));
    }

    @Transactional(readOnly = true)
    public PaymentAvailabilityResponse getPaymentAvailability(Long instituteId) {
        boolean configured = properties.enabled() && StringUtils.hasText(properties.partnerApiKey());
        Optional<CashfreeMerchantAccount> merchant = merchantRepository.findByInstituteId(instituteId);

        if (!configured) {
            return new PaymentAvailabilityResponse(
                    false,
                    merchant.isPresent(),
                    false,
                    merchant.map(CashfreeMerchantAccount::getOnboardingStatus).orElse(null),
                    "Online payments are not configured yet. Please contact school administration."
            );
        }
        if (merchant.isEmpty()) {
            return new PaymentAvailabilityResponse(
                    true,
                    false,
                    false,
                    null,
                    "School payment account setup is pending. Please contact school administration."
            );
        }

        CashfreeMerchantAccount account = merchant.get();
        return new PaymentAvailabilityResponse(
                true,
                true,
                account.isPaymentsEnabled(),
                account.getOnboardingStatus(),
                account.isPaymentsEnabled()
                        ? null
                        : "School payment account KYC is pending. Online payments will be available after activation."
        );
    }

    @Transactional
    public AttemptResponse refreshAttempt(Long instituteId, Long studentId, String orderId) {
        CashfreePaymentAttempt owned = attemptRepository.findByInstituteIdAndStudentIdAndOrderId(instituteId, studentId, orderId)
                .orElseThrow(() -> new ResourceNotFoundException("PAYMENT_ATTEMPT_NOT_FOUND: Payment attempt not found."));
        JsonNode order = client.getOrder(owned.getMerchantAccount().getMerchantId(), orderId);
        if ("PAID".equalsIgnoreCase(order.path("order_status").asText())) {
            JsonNode payments = client.getOrderPayments(owned.getMerchantAccount().getMerchantId(), orderId);
            if (payments.isArray()) {
                for (JsonNode payment : payments) {
                    if ("SUCCESS".equalsIgnoreCase(payment.path("payment_status").asText())) {
                        completeAttempt(orderId, owned.getMerchantAccount().getMerchantId(), payment);
                        break;
                    }
                }
            }
        }
        CashfreePaymentAttempt refreshed = attemptRepository.findByInstituteIdAndStudentIdAndOrderId(instituteId, studentId, orderId).orElseThrow();
        return toAttemptResponse(refreshed);
    }

    @Transactional
    public AttemptResponse reconcileAttempt(Long instituteId, String orderId) {
        CashfreePaymentAttempt attempt = attemptRepository.findByInstituteIdAndOrderId(instituteId, orderId)
                .orElseThrow(() -> new ResourceNotFoundException("PAYMENT_ATTEMPT_NOT_FOUND: Payment attempt not found."));
        return refreshAttempt(instituteId, attempt.getStudent().getId(), orderId);
    }

    @Transactional
    public AttemptResponse cancelStudentAttempt(Long instituteId, Long studentId, String orderId) {
        CashfreePaymentAttempt attempt = attemptRepository.findByInstituteIdAndStudentIdAndOrderId(instituteId, studentId, orderId)
                .orElseThrow(() -> new ResourceNotFoundException("PAYMENT_ATTEMPT_NOT_FOUND: Payment attempt not found."));
        AttemptResponse current = refreshAttempt(instituteId, studentId, orderId);
        if (!"SUCCESS".equalsIgnoreCase(current.status()) && current.feePaymentId() == null) {
            attempt.setStatus("USER_DROPPED");
            attempt.setFailureReason("Checkout closed before payment completion.");
            attemptRepository.save(attempt);
        }
        return toAttemptResponse(attempt);
    }

    @Transactional(readOnly = true)
    public Page<AttemptResponse> getAttempts(Long instituteId, Pageable pageable) {
        return attemptRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId, pageable)
                .map(this::toAttemptResponse);
    }

    @Transactional(readOnly = true)
    public Page<AttemptResponse> getStudentAttempts(Long instituteId, Long studentId, Pageable pageable) {
        return attemptRepository.findAllByInstituteIdAndStudentIdOrderByCreatedAtDesc(instituteId, studentId, pageable)
                .map(this::toAttemptResponse);
    }

    @Transactional
    public void processWebhook(String signature, String timestamp, String rawBody) {
        verifySignature(signature, timestamp, rawBody);
        JsonNode payload;
        try {
            payload = objectMapper.readTree(rawBody);
        } catch (Exception exception) {
            throw new IllegalArgumentException("INVALID_CASHFREE_WEBHOOK: Invalid JSON payload.");
        }
        String type = payload.path("type").asText("UNKNOWN");
        String merchantId = payload.path("merchant").path("merchant_id").asText(null);
        JsonNode order = payload.path("data").path("order");
        JsonNode payment = payload.path("data").path("payment");
        String orderId = order.path("order_id").asText(null);
        String cfPaymentId = payment.path("cf_payment_id").asText(null);
        String eventKey = type + ":" + firstText(cfPaymentId, sha256(rawBody));
        if (webhookRepository.insertIfAbsent(eventKey, type, merchantId, orderId, cfPaymentId, sha256(rawBody)) == 0) return;
        CashfreeWebhookEvent event = webhookRepository.findByEventKey(eventKey).orElseThrow();
        try {
            if (orderId == null || merchantId == null) {
                event.setStatus("IGNORED");
            } else if (type.contains("SUCCESS") || "SUCCESS".equalsIgnoreCase(payment.path("payment_status").asText())) {
                completeAttempt(orderId, merchantId, payment);
                event.setStatus("PROCESSED");
            } else {
                updateFailedAttempt(orderId, merchantId, payment, type);
                event.setStatus("PROCESSED");
            }
            event.setProcessedAt(LocalDateTime.now());
            webhookRepository.save(event);
        } catch (RuntimeException exception) {
            event.setStatus("FAILED");
            event.setFailureReason(limit(exception.getMessage(), 1000));
            webhookRepository.save(event);
            throw exception;
        }
    }

    private void completeAttempt(String orderId, String merchantId, JsonNode payment) {
        CashfreePaymentAttempt attempt = attemptRepository.findByOrderIdForUpdate(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("PAYMENT_ATTEMPT_NOT_FOUND: Unknown Cashfree order."));
        validateMerchant(attempt, merchantId);
        String cfPaymentId = required(payment.path("cf_payment_id").asText(null), "CASHFREE_PAYMENT_ID_MISSING");
        BigDecimal paidAmount = money(payment.path("payment_amount").decimalValue());
        if (paidAmount.compareTo(attempt.getAmount()) != 0) {
            throw new IllegalArgumentException("CASHFREE_AMOUNT_MISMATCH: Paid amount does not match the order.");
        }
        if ("SUCCESS".equals(attempt.getStatus())) {
            if (!cfPaymentId.equals(attempt.getCfPaymentId())) {
                throw new IllegalArgumentException("CASHFREE_DUPLICATE_SUCCESS: Order already has a different successful payment.");
            }
            return;
        }
        String mode = firstText(payment.path("payment_group").asText(null), "Online");
        FeePaymentResponse feePayment = feeService.recordGatewayPayment(
                attempt.getInstitute().getId(),
                attempt.getStudent().getId(),
                attempt.getAcademicSession() == null ? null : attempt.getAcademicSession().getId(),
                paidAmount,
                cfPaymentId,
                attempt.getId(),
                mode
        );
        attempt.setCfPaymentId(cfPaymentId);
        attempt.setPaymentMode(mode);
        attempt.setBankReference(payment.path("bank_reference").asText(null));
        attempt.setPaidAt(parseDateTime(payment.path("payment_time").asText(null)));
        attempt.setFeePaymentId(feePayment.id());
        attempt.setStatus("SUCCESS");
        attempt.setFailureReason(null);
        attemptRepository.save(attempt);
    }

    private String resolveMerchantSiteUrl(String instituteWebsite) {
        String instituteUrl = normalizePublicWebsite(instituteWebsite);
        if (instituteUrl != null) return instituteUrl;

        String configuredUrl = normalizePublicWebsite(properties.merchantSiteUrl());
        if (configuredUrl != null) return configuredUrl;

        throw new IllegalArgumentException(
                "CASHFREE_MERCHANT_WEBSITE_REQUIRED: Configure a valid public HTTPS merchant website."
        );
    }

    private String normalizePublicWebsite(String value) {
        if (!StringUtils.hasText(value)) return null;
        String candidate = value.trim();
        if (!candidate.matches("(?i)^https?://.*")) candidate = "https://" + candidate;
        try {
            URI uri = URI.create(candidate);
            String host = uri.getHost();
            if (host == null || !host.contains(".") || "localhost".equalsIgnoreCase(host)) return null;
            if (!"https".equalsIgnoreCase(uri.getScheme())) return null;
            return uri.toString();
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private void updateFailedAttempt(String orderId, String merchantId, JsonNode payment, String type) {
        CashfreePaymentAttempt attempt = attemptRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (attempt == null || "SUCCESS".equals(attempt.getStatus())) return;
        validateMerchant(attempt, merchantId);
        attempt.setCfPaymentId(payment.path("cf_payment_id").asText(null));
        attempt.setStatus(type.contains("USER_DROPPED") ? "USER_DROPPED" : type.contains("FAILED") ? "FAILED" : "PENDING");
        attempt.setFailureReason(limit(payment.path("payment_message").asText(null), 1000));
        attemptRepository.save(attempt);
    }

    private void verifySignature(String signature, String timestamp, String rawBody) {
        properties.requireConfigured();
        if (!StringUtils.hasText(signature) || !StringUtils.hasText(timestamp)) {
            throw new IllegalArgumentException("INVALID_CASHFREE_SIGNATURE: Webhook signature is missing.");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(properties.partnerApiKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = Base64.getEncoder().encodeToString(mac.doFinal((timestamp + rawBody).getBytes(StandardCharsets.UTF_8)));
            if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException("INVALID_CASHFREE_SIGNATURE: Webhook signature verification failed.");
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("INVALID_CASHFREE_SIGNATURE: Unable to verify webhook signature.");
        }
    }

    private CashfreeMerchantAccount requireMerchant(Long instituteId) {
        return merchantRepository.findByInstituteId(instituteId)
                .orElseThrow(() -> new IllegalArgumentException("CASHFREE_MERCHANT_NOT_ONBOARDED: School must complete Cashfree onboarding."));
    }

    private AcademicSession resolveSession(Long instituteId, Long requestedId) {
        if (requestedId != null) {
            return academicSessionRepository.findByInstituteIdAndId(instituteId, requestedId)
                    .orElseThrow(() -> new ResourceNotFoundException("ACADEMIC_SESSION_NOT_FOUND: Academic session not found."));
        }
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElseThrow(() -> new IllegalArgumentException("ACADEMIC_SESSION_REQUIRED: Current academic session is required."));
    }

    private void validateMerchant(CashfreePaymentAttempt attempt, String merchantId) {
        if (!attempt.getMerchantAccount().getMerchantId().equals(merchantId)) {
            throw new IllegalArgumentException("CASHFREE_MERCHANT_MISMATCH: Webhook merchant does not match the order.");
        }
    }

    private void applyMerchantStatus(CashfreeMerchantAccount account, JsonNode response) {
        String onboarding = firstText(response.path("merchant_status").asText(null), response.path("onboarding_status").asText(null), response.path("status").asText(null), "PENDING");
        String product = pgProductStatus(response.path("product_status"));
        if (!StringUtils.hasText(product)) product = response.path("pg_status").asText(null);
        account.setOnboardingStatus(onboarding.toUpperCase(Locale.ROOT));
        account.setProductStatus(product);
        account.setPaymentsEnabled(response.path("payments_enabled").asBoolean(false)
                || "MIN_KYC_APPROVED".equalsIgnoreCase(product)
                || "ACTIVE".equalsIgnoreCase(product));
    }

    private String pgProductStatus(JsonNode products) {
        if (!products.isArray()) return products.asText(null);
        for (JsonNode product : products) {
            if ("PG".equalsIgnoreCase(product.path("product_name").asText())) {
                return firstText(
                        product.path("product_min_kyc_status").asText(null),
                        product.path("status").asText(null)
                );
            }
        }
        return null;
    }

    private MerchantResponse toMerchantResponse(CashfreeMerchantAccount account, String link, String expiry) {
        return new MerchantResponse(account.getMerchantId(), account.getOnboardingStatus(), account.getProductStatus(), account.isPaymentsEnabled(), link, expiry, account.getId(), account.getVersion());
    }

    private OrderResponse toOrderResponse(CashfreePaymentAttempt attempt) {
        return new OrderResponse(attempt.getId(), attempt.getOrderId(), attempt.getPaymentSessionId(), attempt.getAmount(), attempt.getCurrency(), attempt.getStatus(), properties.environment());
    }

    private AttemptResponse toAttemptResponse(CashfreePaymentAttempt attempt) {
        return new AttemptResponse(
                attempt.getId(),
                attempt.getOrderId(),
                attempt.getCfPaymentId(),
                attempt.getStudent().getId(),
                studentName(attempt.getStudent()),
                attempt.getAmount(),
                attempt.getCurrency(),
                attempt.getStatus(),
                attempt.getPaymentMode(),
                attempt.getBankReference(),
                attempt.getFeePaymentId(),
                attempt.getPaidAt(),
                attempt.getCreatedAt()
        );
    }

    private String buildMerchantId(Institute institute) {
        String code = firstText(institute.getInstitutionCode(), "SCHOOL").replaceAll("[^A-Za-z0-9_-]", "").toUpperCase(Locale.ROOT);
        return limit("VDY_" + institute.getId() + "_" + code, 40);
    }

    private String studentName(Student student) {
        return firstText((firstText(student.getFirstName(), "") + " " + firstText(student.getLastName(), "")).trim(), student.getName(), student.getEnrollmentNo(), "Student");
    }

    private String normalizePhone(String value) {
        String digits = firstText(value, "").replaceAll("\\D", "");
        if (digits.length() > 10) digits = digits.substring(digits.length() - 10);
        if (digits.length() != 10) throw new IllegalArgumentException("VALID_PHONE_REQUIRED: A valid 10-digit phone is required for Cashfree.");
        return digits;
    }

    private String normalizeOrderStatus(String value) {
        String normalized = firstText(value, "ACTIVE").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PAID" -> "SUCCESS";
            case "EXPIRED", "TERMINATED" -> "EXPIRED";
            default -> "ACTIVE";
        };
    }

    private LocalDateTime parseDateTime(String value) {
        if (!StringUtils.hasText(value)) return LocalDateTime.now();
        try { return OffsetDateTime.parse(value).toLocalDateTime(); }
        catch (RuntimeException ignored) { return LocalDateTime.now(); }
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String text(JsonNode node, String field, String fallback) {
        return firstText(node.path(field).asText(null), fallback);
    }

    private String required(String value, String code) {
        if (!StringUtils.hasText(value)) throw new IllegalArgumentException(code + ": Required value is missing.");
        return value.trim();
    }

    private String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private String limit(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private String firstText(String... values) {
        for (String value : values) if (StringUtils.hasText(value)) return value.trim();
        return "";
    }
}
