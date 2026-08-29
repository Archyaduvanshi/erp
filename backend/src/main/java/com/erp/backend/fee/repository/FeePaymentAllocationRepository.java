package com.erp.backend.fee.repository;

import java.util.List;

import com.erp.backend.fee.entity.FeePaymentAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeePaymentAllocationRepository extends JpaRepository<FeePaymentAllocation, Long> {

    List<FeePaymentAllocation> findAllByInstituteIdAndStudentId(Long instituteId, Long studentId);

    boolean existsByInstituteIdAndFeeStructureId(Long instituteId, Long feeStructureId);

    boolean existsByInstituteIdAndPaymentId(Long instituteId, Long paymentId);

    @Query("""
            select a
            from FeePaymentAllocation a
            join fetch a.payment
            where a.institute.id = :instituteId
              and a.student.id = :studentId
              and (:academicSessionId is null or a.academicSession is null or a.academicSession.id = :academicSessionId)
              and upper(coalesce(a.allocationType, '')) in ('ADVANCE', 'ADVANCE_APPLIED')
              and lower(coalesce(a.payment.paymentStatus, '')) in ('completed', 'success')
            order by a.createdAt asc
            """)
    List<FeePaymentAllocation> findCompletedAdvanceLedgerForStudent(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select a
            from FeePaymentAllocation a
            where a.institute.id = :instituteId
              and a.student.id = :studentId
              and (:academicSessionId is null or a.academicSession is null or a.academicSession.id = :academicSessionId)
              and lower(coalesce(a.payment.paymentStatus, '')) in ('completed', 'success')
            """)
    List<FeePaymentAllocation> findCompletedAllocationsForStudent(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select coalesce(sum(a.amount), 0)
            from FeePaymentAllocation a
            where a.institute.id = :instituteId
              and (:academicSessionId is null or a.academicSession is null or a.academicSession.id = :academicSessionId)
              and lower(coalesce(a.payment.paymentStatus, '')) in ('completed', 'success')
            """)
    java.math.BigDecimal sumCompletedAllocations(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select coalesce(sum(a.amount), 0)
            from FeePaymentAllocation a
            where a.institute.id = :instituteId
              and a.student.id = :studentId
              and (:academicSessionId is null or a.academicSession is null or a.academicSession.id = :academicSessionId)
              and a.studentFeeCharge is null
              and upper(coalesce(a.allocationType, '')) = 'ADVANCE'
              and lower(coalesce(a.payment.paymentStatus, '')) in ('completed', 'success')
            """)
    java.math.BigDecimal sumAdvanceCredits(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select coalesce(sum(a.amount), 0)
            from FeePaymentAllocation a
            where a.institute.id = :instituteId
              and a.student.id = :studentId
              and (:academicSessionId is null or a.academicSession is null or a.academicSession.id = :academicSessionId)
              and a.studentFeeCharge is not null
              and upper(coalesce(a.allocationType, '')) = 'ADVANCE_APPLIED'
              and lower(coalesce(a.payment.paymentStatus, '')) in ('completed', 'success')
            """)
    java.math.BigDecimal sumAdvanceApplied(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId
    );
}
