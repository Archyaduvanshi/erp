package com.erp.backend.fee.controller;

import java.math.BigDecimal;
import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.fee.dto.FeeDueResponse;
import com.erp.backend.fee.dto.FeeOverviewResponse;
import com.erp.backend.fee.dto.FeePaymentPayload;
import com.erp.backend.fee.dto.FeePaymentResponse;
import com.erp.backend.fee.dto.FeePaymentVoidPayload;
import com.erp.backend.fee.dto.FeeReceiptSearchResponse;
import com.erp.backend.fee.dto.FeeStudentSearchResponse;
import com.erp.backend.fee.dto.FeeStudentSummaryResponse;
import com.erp.backend.fee.dto.FeeStructurePayload;
import com.erp.backend.fee.dto.FeeStructureResponse;
import com.erp.backend.fee.service.FeeService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fees")
public class FeeController {

    private final FeeService feeService;

    public FeeController(FeeService feeService) {
        this.feeService = feeService;
    }

    @GetMapping("/overview")
    public FeeOverviewResponse getOverview(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return feeService.getOverview(instituteId, academicSessionId);
    }

    @GetMapping("/classes")
    public List<String> getClasses(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return feeService.getClasses(instituteId, academicSessionId);
    }

    @GetMapping("/structures")
    public List<FeeStructureResponse> getStructures(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(defaultValue = "") String className,
            @RequestParam(defaultValue = "") String category
    ) {
        return feeService.getStructures(instituteId, academicSessionId, className, category);
    }

    @PostMapping("/structures")
    @ResponseStatus(HttpStatus.CREATED)
    public FeeStructureResponse saveStructure(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody FeeStructurePayload request
    ) {
        return feeService.saveStructure(instituteId, request);
    }

    @DeleteMapping("/structures/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStructure(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        feeService.deleteStructure(instituteId, id);
    }

    @GetMapping("/students/search")
    public Page<FeeStudentSearchResponse> searchStudents(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String className,
            @RequestParam(defaultValue = "") String section,
            Pageable pageable
    ) {
        return feeService.searchStudents(instituteId, search, className, section, pageable);
    }

    @GetMapping("/students/{studentId}/summary")
    public FeeStudentSummaryResponse getStudentSummary(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long studentId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return feeService.getStudentSummary(instituteId, studentId, academicSessionId);
    }

    @GetMapping("/students/{studentId}/payments")
    public Page<FeePaymentResponse> getStudentPayments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long studentId,
            @RequestParam(required = false) Long academicSessionId,
            Pageable pageable
    ) {
        return feeService.getStudentPayments(instituteId, studentId, academicSessionId, pageable);
    }

    @GetMapping("/dues")
    public Page<FeeDueResponse> getDues(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String className,
            @RequestParam(defaultValue = "") String section,
            @RequestParam(required = false) BigDecimal minOutstanding,
            Pageable pageable
    ) {
        return feeService.getDues(instituteId, academicSessionId, search, className, section, minOutstanding, pageable);
    }

    @GetMapping("/receipts")
    public Page<FeeReceiptSearchResponse> getReceipts(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String mode,
            @RequestParam(defaultValue = "") String status,
            Pageable pageable
    ) {
        return feeService.getReceipts(instituteId, academicSessionId, search, mode, status, pageable);
    }

    @GetMapping("/payments")
    public Page<FeePaymentResponse> getPayments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long studentId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String mode,
            @RequestParam(defaultValue = "") String status,
            Pageable pageable
    ) {
        return feeService.getPayments(instituteId, studentId, academicSessionId, search, mode, status, pageable);
    }

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public FeePaymentResponse savePayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody FeePaymentPayload request
    ) {
        return feeService.savePayment(principal.instituteId(), request, principal);
    }

    @PostMapping("/payments/{id}/void")
    public FeePaymentResponse voidPayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody FeePaymentVoidPayload request
    ) {
        return feeService.voidPayment(principal.instituteId(), id, request.reason(), principal);
    }

    @PostMapping("/payments/{id}/verify")
    public FeePaymentResponse verifyPayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id
    ) {
        return feeService.verifyPayment(principal.instituteId(), id, principal);
    }

    @PostMapping("/payments/{id}/reject")
    public FeePaymentResponse rejectPayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody FeePaymentVoidPayload request
    ) {
        return feeService.rejectPayment(principal.instituteId(), id, request.reason(), principal);
    }

    @DeleteMapping("/payments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id
    ) {
        feeService.deletePayment(principal.instituteId(), id, principal);
    }

    @GetMapping("/student/me/summary")
    public FeeStudentSummaryResponse getMySummary(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return feeService.getMyStudentSummary(principal.instituteId(), principal.studentId(), academicSessionId);
    }

    @GetMapping("/student/me/payments")
    public Page<FeePaymentResponse> getMyPayments(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String mode,
            @RequestParam(defaultValue = "") String status,
            Pageable pageable
    ) {
        return feeService.getPayments(principal.instituteId(), principal.studentId(), academicSessionId, search, mode, status, pageable);
    }

    @PostMapping("/student/me/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public FeePaymentResponse saveMyPayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody FeePaymentPayload request
    ) {
        return feeService.saveMyPayment(principal.instituteId(), principal.studentId(), request, principal);
    }
}
