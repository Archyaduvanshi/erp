package com.erp.backend.curriculum.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.curriculum.entity.AcademicSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AcademicSessionRepository extends JpaRepository<AcademicSession, Long> {

    List<AcademicSession> findAllByInstituteIdOrderByCurrentDescNameDesc(Long instituteId);

    Optional<AcademicSession> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<AcademicSession> findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(Long instituteId);

    Optional<AcademicSession> findByInstituteIdAndNameIgnoreCase(Long instituteId, String name);
}
