package com.erp.backend.report.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.erp.backend.report.service.SalaryReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports/salary")
public class SalaryReportController {

    private final SalaryReportService salaryReportService;

    public SalaryReportController(SalaryReportService salaryReportService) {
        this.salaryReportService = salaryReportService;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(defaultValue = "") String monthKey
    ) {
        return salaryReportService.summary(instituteId, monthKey);
    }

    @GetMapping("/payments")
    public List<Map<String, Object>> payments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "month") String groupBy
    ) {
        return salaryReportService.payments(instituteId, dateFrom, dateTo, groupBy);
    }

    @GetMapping("/outstanding")
    public List<Map<String, Object>> outstanding(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(defaultValue = "") String monthKey
    ) {
        return salaryReportService.outstanding(instituteId, monthKey);
    }
}
