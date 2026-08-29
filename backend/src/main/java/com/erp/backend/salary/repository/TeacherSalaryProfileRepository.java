package com.erp.backend.salary.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.erp.backend.salary.entity.TeacherSalaryProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeacherSalaryProfileRepository extends JpaRepository<TeacherSalaryProfile, Long> {

    List<TeacherSalaryProfile> findAllByInstituteIdAndTeacherIdOrderByEffectiveFromDesc(Long instituteId, Long teacherId);

    @Query("""
            select p
            from TeacherSalaryProfile p
            where p.institute.id = :instituteId
              and p.teacher.id = :teacherId
              and p.status = 'ACTIVE'
              and p.effectiveFrom <= :asOfDate
              and (p.effectiveTo is null or p.effectiveTo >= :asOfDate)
            order by p.effectiveFrom desc
            """)
    List<TeacherSalaryProfile> findActiveProfilesForDate(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("asOfDate") LocalDate asOfDate
    );

    @Query("""
            select p
            from TeacherSalaryProfile p
            where p.institute.id = :instituteId
              and p.teacher.id in :teacherIds
              and p.status = 'ACTIVE'
              and p.effectiveFrom <= :toDate
              and (p.effectiveTo is null or p.effectiveTo >= :fromDate)
            order by p.teacher.id asc, p.effectiveFrom desc
            """)
    List<TeacherSalaryProfile> findActiveProfilesForTeachersInRange(
            @Param("instituteId") Long instituteId,
            @Param("teacherIds") List<Long> teacherIds,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

    @Query("""
            select p
            from TeacherSalaryProfile p
            where p.institute.id = :instituteId
              and p.teacher.id = :teacherId
              and p.status = 'ACTIVE'
              and p.effectiveTo is null
            order by p.effectiveFrom desc
            """)
    Optional<TeacherSalaryProfile> findCurrentOpenProfile(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId
    );

    @Query("""
            select case when count(p) > 0 then true else false end
            from TeacherSalaryProfile p
            where p.institute.id = :instituteId
              and p.teacher.id = :teacherId
              and p.status = 'ACTIVE'
              and (:excludedId is null or p.id <> :excludedId)
              and p.effectiveFrom <= :effectiveTo
              and coalesce(p.effectiveTo, :openEndedDate) >= :effectiveFrom
            """)
    boolean existsOverlappingActiveProfile(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("effectiveFrom") LocalDate effectiveFrom,
            @Param("effectiveTo") LocalDate effectiveTo,
            @Param("openEndedDate") LocalDate openEndedDate,
            @Param("excludedId") Long excludedId
    );
}
