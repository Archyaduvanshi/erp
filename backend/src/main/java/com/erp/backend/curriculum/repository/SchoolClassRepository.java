package com.erp.backend.curriculum.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.erp.backend.curriculum.entity.SchoolClass;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SchoolClassRepository extends JpaRepository<SchoolClass, Long> {

    List<SchoolClass> findAllByInstituteIdOrderByNameAsc(Long instituteId);

    Optional<SchoolClass> findByInstituteIdAndId(Long instituteId, Long id);

    List<SchoolClass> findAllByInstituteIdAndIdIn(Long instituteId, Set<Long> ids);

    Optional<SchoolClass> findByInstituteIdAndNormalizedName(Long instituteId, String normalizedName);

    List<SchoolClass> findAllByInstituteIdAndNormalizedNameIn(Long instituteId, Set<String> normalizedNames);
}
