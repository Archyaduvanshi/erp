package com.erp.backend.report.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.erp.backend.report.service.FeeReportService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports/fees")
public class FeeReportController {

    private final FeeReportService feeReportService;

    public FeeReportController(FeeReportService feeReportService) {
        this.feeReportService = feeReportService;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return feeReportService.summary(instituteId, academicSessionId);
    }

    @GetMapping("/collections")
    public List<Map<String, Object>> collections(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(defaultValue = "month") String groupBy
    ) {
        return feeReportService.collections(instituteId, academicSessionId, dateFrom, dateTo, groupBy);
    }

    @GetMapping("/outstanding")
    public List<Map<String, Object>> outstanding(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return feeReportService.outstanding(instituteId, academicSessionId);
    }
}
