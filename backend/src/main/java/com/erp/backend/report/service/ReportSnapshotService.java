package com.erp.backend.report.service;

import java.time.LocalDateTime;
import java.util.List;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.report.dto.ReportSnapshotPayload;
import com.erp.backend.report.dto.ReportSnapshotResponse;
import com.erp.backend.report.entity.ReportSnapshot;
import com.erp.backend.report.repository.ReportSnapshotRepository;
import org.springframework.stereotype.Service;

@Service
public class ReportSnapshotService {

    private final InstituteRepository instituteRepository;
    private final ReportSnapshotRepository reportSnapshotRepository;

    public ReportSnapshotService(
            InstituteRepository instituteRepository,
            ReportSnapshotRepository reportSnapshotRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.reportSnapshotRepository = reportSnapshotRepository;
    }

    public List<ReportSnapshotResponse> getSnapshots(Long instituteId) {
        validateInstitute(instituteId);
        return reportSnapshotRepository.findAllByInstituteIdOrderByGeneratedAtDesc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ReportSnapshotResponse saveSnapshot(Long instituteId, ReportSnapshotPayload request) {
        Institute institute = validateInstitute(instituteId);
        ReportSnapshot snapshot = new ReportSnapshot();
        snapshot.setInstitute(institute);
        snapshot.setCategory(request.category().trim());
        snapshot.setReportKey(request.reportKey().trim());
        snapshot.setTitle(request.title().trim());
        snapshot.setFiltersJson(request.filtersJson());
        snapshot.setKpisJson(request.kpisJson());
        snapshot.setChartsJson(request.chartsJson());
        snapshot.setRowsJson(request.rowsJson());
        snapshot.setRowCount(request.rowCount() == null ? 0 : request.rowCount());
        snapshot.setGeneratedAt(parseGeneratedAt(request.generatedAt()));
        return toResponse(reportSnapshotRepository.save(snapshot));
    }

    public void deleteSnapshot(Long instituteId, Long id) {
        ReportSnapshot snapshot = reportSnapshotRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Report snapshot not found with id: " + id));
        reportSnapshotRepository.delete(snapshot);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private LocalDateTime parseGeneratedAt(String value) {
        if (value == null || value.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            return LocalDateTime.parse(value);
        } catch (RuntimeException ignored) {
            return LocalDateTime.now();
        }
    }

    private ReportSnapshotResponse toResponse(ReportSnapshot snapshot) {
        return new ReportSnapshotResponse(
                snapshot.getId(),
                snapshot.getCategory(),
                snapshot.getReportKey(),
                snapshot.getTitle(),
                snapshot.getFiltersJson(),
                snapshot.getKpisJson(),
                snapshot.getChartsJson(),
                snapshot.getRowsJson(),
                snapshot.getRowCount(),
                snapshot.getGeneratedAt(),
                snapshot.getCreatedAt(),
                snapshot.getUpdatedAt()
        );
    }
}
