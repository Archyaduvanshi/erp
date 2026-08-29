package com.erp.backend.salary.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.salary.dto.SalaryOverviewResponse;
import com.erp.backend.salary.dto.SalaryPaymentVoidPayload;
import com.erp.backend.salary.dto.TeacherPayrollPeriodResponse;
import com.erp.backend.salary.dto.TeacherSalaryPaymentPayload;
import com.erp.backend.salary.dto.TeacherSalaryPaymentResponse;
import com.erp.backend.salary.dto.TeacherSalarySummaryResponse;
import com.erp.backend.salary.service.TeacherSalaryPaymentService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/salary")
public class TeacherSalaryPaymentController {

    private final TeacherSalaryPaymentService salaryPaymentService;

    public TeacherSalaryPaymentController(TeacherSalaryPaymentService salaryPaymentService) {
        this.salaryPaymentService = salaryPaymentService;
    }

    @GetMapping("/overview")
    public SalaryOverviewResponse getOverview(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) String monthKey
    ) {
        return salaryPaymentService.getOverview(instituteId, monthKey);
    }

    @GetMapping("/payments")
    public List<TeacherSalaryPaymentResponse> getPayments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long teacherId
    ) {
        return salaryPaymentService.getPayments(instituteId, teacherId);
    }

    @GetMapping("/payments/page")
    public Page<TeacherSalaryPaymentResponse> getPaymentsPage(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long teacherId,
            @RequestParam(defaultValue = "") String monthKey,
            @RequestParam(defaultValue = "") String status,
            Pageable pageable
    ) {
        return salaryPaymentService.getPaymentsPage(instituteId, teacherId, monthKey, status, pageable);
    }

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public TeacherSalaryPaymentResponse savePayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody TeacherSalaryPaymentPayload request
    ) {
        return salaryPaymentService.savePayment(principal.instituteId(), principal.accountId(), request);
    }

    @PostMapping("/payments/{id}/void")
    public TeacherSalaryPaymentResponse voidPayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @RequestBody(required = false) SalaryPaymentVoidPayload request
    ) {
        return salaryPaymentService.voidPayment(principal.instituteId(), principal.accountId(), id, request);
    }

    @GetMapping("/payroll-periods")
    public Page<TeacherPayrollPeriodResponse> getPayrollPeriods(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long teacherId,
            @RequestParam(defaultValue = "") String monthKey,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String search,
            Pageable pageable
    ) {
        return salaryPaymentService.getPayrollPeriods(instituteId, teacherId, monthKey, status, search, pageable);
    }

    @PostMapping("/payroll-periods/generate")
    public TeacherPayrollPeriodResponse generatePayrollPeriod(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam Long teacherId,
            @RequestParam String monthKey
    ) {
        return salaryPaymentService.getOrGeneratePayrollPeriod(principal.instituteId(), teacherId, monthKey, principal.accountId());
    }

    @PostMapping("/payroll-periods/generate-month")
    public List<TeacherPayrollPeriodResponse> generatePayrollPeriodsForMonth(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam String monthKey,
            @RequestParam(required = false) Long teacherId
    ) {
        return salaryPaymentService.generatePayrollPeriodsForMonth(principal.instituteId(), monthKey, teacherId, principal.accountId());
    }

    @GetMapping("/teachers/{teacherId}/summary")
    public TeacherSalarySummaryResponse getTeacherSummary(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long teacherId,
            @RequestParam(defaultValue = "") String monthKey
    ) {
        return salaryPaymentService.getTeacherSummary(instituteId, teacherId, monthKey);
    }

    @GetMapping("/teachers/{teacherId}/payments")
    public Page<TeacherSalaryPaymentResponse> getTeacherPayments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long teacherId,
            @RequestParam(defaultValue = "") String monthKey,
            Pageable pageable
    ) {
        return salaryPaymentService.getPaymentsPage(instituteId, teacherId, monthKey, "", pageable);
    }

    @GetMapping("/teacher/me/summary")
    public TeacherSalarySummaryResponse getMySummary(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "") String monthKey
    ) {
        return salaryPaymentService.getMySummary(principal.instituteId(), principal.teacherId(), monthKey);
    }

    @GetMapping("/teacher/me/payroll-periods")
    public Page<TeacherPayrollPeriodResponse> getMyPayrollPeriods(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "") String monthKey,
            @RequestParam(defaultValue = "") String status,
            Pageable pageable
    ) {
        return salaryPaymentService.getMyPayrollPeriods(principal.instituteId(), principal.teacherId(), monthKey, status, pageable);
    }

    @GetMapping("/teacher/me/payments")
    public Page<TeacherSalaryPaymentResponse> getMyPayments(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "") String monthKey,
            Pageable pageable
    ) {
        return salaryPaymentService.getMyPayments(principal.instituteId(), principal.teacherId(), monthKey, pageable);
    }
}
