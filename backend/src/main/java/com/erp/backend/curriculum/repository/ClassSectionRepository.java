package com.erp.backend.curriculum.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.curriculum.entity.ClassSection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassSectionRepository extends JpaRepository<ClassSection, Long> {

    List<ClassSection> findAllByInstituteIdAndSchoolClassIdOrderByNameAsc(Long instituteId, Long schoolClassId);

    List<ClassSection> findAllByInstituteIdOrderBySchoolClassIdAscNameAsc(Long instituteId);

    Optional<ClassSection> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<ClassSection> findByInstituteIdAndSchoolClassIdAndNormalizedName(Long instituteId, Long schoolClassId, String normalizedName);
}
