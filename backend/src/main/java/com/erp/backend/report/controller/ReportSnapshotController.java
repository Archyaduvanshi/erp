package com.erp.backend.report.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.report.dto.ReportSnapshotPayload;
import com.erp.backend.report.dto.ReportSnapshotResponse;
import com.erp.backend.report.service.ReportSnapshotService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportSnapshotController {

    private final ReportSnapshotService reportSnapshotService;

    public ReportSnapshotController(ReportSnapshotService reportSnapshotService) {
        this.reportSnapshotService = reportSnapshotService;
    }

    @GetMapping
    public List<ReportSnapshotResponse> getSnapshots(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return reportSnapshotService.getSnapshots(instituteId);
    }

    @GetMapping("/snapshots")
    public Page<ReportSnapshotResponse> getSnapshotsPage(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return reportSnapshotService.getSnapshots(instituteId, pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReportSnapshotResponse saveSnapshot(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody ReportSnapshotPayload request
    ) {
        return reportSnapshotService.saveSnapshot(instituteId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSnapshot(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        reportSnapshotService.deleteSnapshot(instituteId, id);
    }
}
