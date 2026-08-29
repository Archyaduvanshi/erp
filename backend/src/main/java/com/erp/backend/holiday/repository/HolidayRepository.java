package com.erp.backend.holiday.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.erp.backend.holiday.entity.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {

    @Query("""
            select distinct h
            from Holiday h
            left join fetch h.targetClassMappings target
            left join fetch target.schoolClass
            where h.institute.id = :instituteId
            order by h.holidayDate asc
            """)
    List<Holiday> findAllWithTargets(@Param("instituteId") Long instituteId);

    @Query("""
            select distinct h
            from Holiday h
            left join fetch h.targetClassMappings target
            left join fetch target.schoolClass
            where h.institute.id = :instituteId
              and h.holidayDate between :from and :to
            order by h.holidayDate asc
            """)
    List<Holiday> findAllWithTargetsInRange(
            @Param("instituteId") Long instituteId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    Optional<Holiday> findByInstituteIdAndId(Long instituteId, Long id);
}
