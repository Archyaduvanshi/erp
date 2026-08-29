package com.erp.backend.curriculum.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.erp.backend.curriculum.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubjectRepository extends JpaRepository<Subject, Long> {

    List<Subject> findAllByInstituteIdOrderByNameAsc(Long instituteId);

    Optional<Subject> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<Subject> findByInstituteIdAndNormalizedName(Long instituteId, String normalizedName);

    List<Subject> findAllByInstituteIdAndNormalizedNameIn(Long instituteId, Set<String> normalizedNames);

    Optional<Subject> findByInstituteIdAndCodeIgnoreCase(Long instituteId, String code);
}
