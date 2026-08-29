package com.erp.backend.report.controller;

import java.util.Map;

import com.erp.backend.report.service.ReportAnalyticsService;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportAnalyticsController {

    private final ReportAnalyticsService reportAnalyticsService;

    public ReportAnalyticsController(ReportAnalyticsService reportAnalyticsService) {
        this.reportAnalyticsService = reportAnalyticsService;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return reportAnalyticsService.overview(instituteId, academicSessionId);
    }

    @GetMapping("/{category}/bundle")
    public Map<String, Object> categoryBundle(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable String category,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam Map<String, String> filters,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        return reportAnalyticsService.categoryBundle(instituteId, category, academicSessionId, filters, pageable);
    }

    @GetMapping("/{category}/{reportKey}")
    public Map<String, Object> report(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable String category,
            @PathVariable String reportKey,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam Map<String, String> filters,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        return reportAnalyticsService.report(instituteId, category, reportKey, academicSessionId, filters, pageable);
    }

    @GetMapping("/{category}/{reportKey}/export")
    public Map<String, Object> export(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable String category,
            @PathVariable String reportKey,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam Map<String, String> filters
    ) {
        return reportAnalyticsService.export(instituteId, category, reportKey, academicSessionId, filters);
    }
}
