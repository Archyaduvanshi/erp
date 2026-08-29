package com.erp.backend.salary.repository;

import java.math.BigDecimal;
import java.util.List;

import com.erp.backend.salary.entity.SalaryPaymentAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalaryPaymentAllocationRepository extends JpaRepository<SalaryPaymentAllocation, Long> {

    boolean existsByInstituteIdAndSalaryPaymentId(Long instituteId, Long salaryPaymentId);

    List<SalaryPaymentAllocation> findAllByInstituteIdAndTeacherId(Long instituteId, Long teacherId);

    @Query("""
            select coalesce(sum(a.amount), 0)
            from SalaryPaymentAllocation a
            where a.institute.id = :instituteId
              and a.payrollPeriod.id = :payrollPeriodId
              and a.salaryPayment.status = 'COMPLETED'
            """)
    BigDecimal sumAllocatedToPayrollPeriod(
            @Param("instituteId") Long instituteId,
            @Param("payrollPeriodId") Long payrollPeriodId
    );

    @Query("""
            select coalesce(sum(p.outstandingAmount), 0)
            from TeacherPayrollPeriod p
            where p.institute.id = :instituteId
              and p.teacher.id = :teacherId
              and p.monthKey < :monthKey
              and p.status <> 'VOIDED'
            """)
    BigDecimal sumPreviousOutstanding(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("monthKey") String monthKey
    );

    @Query("""
            select a.payrollPeriod.monthKey
            from SalaryPaymentAllocation a
            where a.institute.id = :instituteId
              and a.salaryPayment.id = :salaryPaymentId
              and a.salaryPayment.status = 'COMPLETED'
            order by a.payrollPeriod.monthKey asc
            """)
    List<String> findSettledMonthKeysByPayment(
            @Param("instituteId") Long instituteId,
            @Param("salaryPaymentId") Long salaryPaymentId
    );

    @Query("""
            select coalesce(sum(a.amount), 0)
            from SalaryPaymentAllocation a
            where a.institute.id = :instituteId
              and (:monthKey = '' or a.payrollPeriod.monthKey = :monthKey)
              and a.salaryPayment.status = 'COMPLETED'
            """)
    BigDecimal sumAllocated(
            @Param("instituteId") Long instituteId,
            @Param("monthKey") String monthKey
    );

    List<SalaryPaymentAllocation> findAllByInstituteIdAndSalaryPaymentId(Long instituteId, Long salaryPaymentId);
}
