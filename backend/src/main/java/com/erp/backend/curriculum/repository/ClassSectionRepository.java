package com.erp.backend.curriculum.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.curriculum.entity.ClassSection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassSectionRepository extends JpaRepository<ClassSection, Long> {

    List<ClassSection> findAllByInstituteIdAndSchoolClassIdOrderByNameAsc(Long instituteId, Long schoolClassId);

    List<ClassSection> findAllByInstituteIdOrderBySchoolClassIdAscNameAsc(Long instituteId);

    Optional<ClassSection> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<ClassSection> findByInstituteIdAndSchoolClassIdAndNormalizedName(Long instituteId, Long schoolClassId, String normalizedName);

    List<ClassSection> findAllByInstituteIdAndSchoolClassIdAndStatusNotIgnoreCaseOrderByNameAsc(Long instituteId, Long schoolClassId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s
            from ClassSection s
            join fetch s.schoolClass c
            where s.institute.id = :instituteId
              and s.id = :sectionId
            """)
    Optional<ClassSection> findByInstituteIdAndIdForUpdate(@Param("instituteId") Long instituteId, @Param("sectionId") Long sectionId);
}
