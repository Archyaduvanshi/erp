package com.erp.backend.salary.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.salary.entity.TeacherPayrollPeriod;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeacherPayrollPeriodRepository extends JpaRepository<TeacherPayrollPeriod, Long> {

    Optional<TeacherPayrollPeriod> findByInstituteIdAndTeacherIdAndMonthKey(Long instituteId, Long teacherId, String monthKey);

    List<TeacherPayrollPeriod> findAllByInstituteIdAndMonthKey(Long instituteId, String monthKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from TeacherPayrollPeriod p where p.institute.id = :instituteId and p.teacher.id = :teacherId and p.monthKey = :monthKey")
    Optional<TeacherPayrollPeriod> findByInstituteIdAndTeacherIdAndMonthKeyForUpdate(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("monthKey") String monthKey
    );

    @Query("""
            select p
            from TeacherPayrollPeriod p
            where p.institute.id = :instituteId
              and (:teacherId is null or p.teacher.id = :teacherId)
              and (:monthKey = '' or p.monthKey = :monthKey)
              and (:status = ''
                   or (:status = 'UNPAID' and p.status <> 'PAID')
                   or lower(p.status) = lower(:status))
              and (:search = '' or lower(concat(coalesce(p.teacher.firstName, ''), ' ', coalesce(p.teacher.lastName, ''), ' ', coalesce(p.teacher.name, ''), ' ', coalesce(p.teacher.employeeId, ''))) like lower(concat('%', :search, '%')))
            order by p.monthKey desc, p.teacher.firstName asc, p.teacher.lastName asc
            """)
    Page<TeacherPayrollPeriod> findPayrollPeriods(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("monthKey") String monthKey,
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable
    );

    List<TeacherPayrollPeriod> findAllByInstituteIdAndTeacherIdOrderByMonthKeyDesc(Long instituteId, Long teacherId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select p
            from TeacherPayrollPeriod p
            where p.institute.id = :instituteId
              and p.teacher.id = :teacherId
              and p.status <> 'PAID'
            order by p.monthKey asc
            """)
    List<TeacherPayrollPeriod> lockOpenPeriodsForTeacher(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId
    );
}
