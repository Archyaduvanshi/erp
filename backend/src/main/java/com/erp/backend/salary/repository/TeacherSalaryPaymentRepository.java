package com.erp.backend.salary.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.salary.entity.TeacherSalaryPayment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeacherSalaryPaymentRepository extends JpaRepository<TeacherSalaryPayment, Long> {

    List<TeacherSalaryPayment> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    List<TeacherSalaryPayment> findAllByInstituteIdAndTeacherIdOrderByMonthKeyDesc(Long instituteId, Long teacherId);

    Optional<TeacherSalaryPayment> findByInstituteIdAndTeacherIdAndMonthKey(Long instituteId, Long teacherId, String monthKey);

    Optional<TeacherSalaryPayment> findByInstituteIdAndIdempotencyKey(Long instituteId, String idempotencyKey);

    Optional<TeacherSalaryPayment> findByInstituteIdAndPaymentReference(Long instituteId, String paymentReference);

    boolean existsByInstituteIdAndTransactionReferenceIgnoreCaseAndStatusNot(Long instituteId, String transactionReference, String status);

    Optional<TeacherSalaryPayment> findByInstituteIdAndId(Long instituteId, Long id);

    @Query("""
            select p
            from TeacherSalaryPayment p
            where p.institute.id = :instituteId
              and (:teacherId is null or p.teacher.id = :teacherId)
              and (:monthKey = '' or p.monthKey = :monthKey)
              and (:status = '' or lower(coalesce(p.status, 'COMPLETED')) = lower(:status))
            order by p.paidOn desc nulls last, p.createdAt desc
            """)
    Page<TeacherSalaryPayment> findPayments(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("monthKey") String monthKey,
            @Param("status") String status,
            Pageable pageable
    );

    @Query("""
            select coalesce(sum(p.totalAmount), 0)
            from TeacherSalaryPayment p
            where p.institute.id = :instituteId
              and lower(coalesce(p.status, 'COMPLETED')) = 'completed'
              and (:monthKey = '' or p.monthKey = :monthKey)
            """)
    java.math.BigDecimal sumCompletedPayments(@Param("instituteId") Long instituteId, @Param("monthKey") String monthKey);

    @Query("""
            select coalesce(sum(p.totalAmount), 0)
            from TeacherSalaryPayment p
            where p.institute.id = :instituteId
              and p.teacher.id = :teacherId
              and lower(coalesce(p.status, 'COMPLETED')) = 'completed'
            """)
    java.math.BigDecimal sumCompletedPaymentsForTeacher(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId
    );
}
