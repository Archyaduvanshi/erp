package com.erp.backend.report.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.report.entity.ReportSnapshot;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportSnapshotRepository extends JpaRepository<ReportSnapshot, Long> {

    List<ReportSnapshot> findAllByInstituteIdOrderByGeneratedAtDesc(Long instituteId);

    Page<ReportSnapshot> findAllByInstituteIdOrderByGeneratedAtDesc(Long instituteId, Pageable pageable);

    Optional<ReportSnapshot> findByInstituteIdAndId(Long instituteId, Long id);
}
