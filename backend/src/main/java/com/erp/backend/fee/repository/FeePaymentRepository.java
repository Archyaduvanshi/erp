package com.erp.backend.fee.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.fee.dto.FeeReceiptSearchResponse;
import com.erp.backend.fee.entity.FeePayment;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeePaymentRepository extends JpaRepository<FeePayment, Long> {

    List<FeePayment> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    List<FeePayment> findAllByInstituteIdAndStudentIdOrderByCreatedAtDesc(Long instituteId, Long studentId);

    @Query("""
            select fp
            from FeePayment fp
            where fp.institute.id = :instituteId
              and (:studentId is null or fp.studentId = :studentId)
              and (:academicSessionId is null or fp.academicSession.id = :academicSessionId or fp.academicSession is null)
              and (:mode = '' or lower(coalesce(fp.mode, '')) = lower(:mode))
              and (:status = '' or lower(coalesce(fp.paymentStatus, '')) = lower(:status))
              and (:search = '' or lower(concat(coalesce(fp.receiptNumber, ''), ' ', coalesce(fp.transactionId, ''), ' ', coalesce(fp.gatewayRef, ''))) like lower(concat('%', :search, '%')))
            order by fp.paymentDate desc nulls last, fp.createdAt desc
            """)
    Page<FeePayment> findPayments(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("search") String search,
            @Param("mode") String mode,
            @Param("status") String status,
            Pageable pageable
    );

    @Query("""
            select fp
            from FeePayment fp
            where fp.institute.id = :instituteId
              and fp.studentId = :studentId
              and lower(coalesce(fp.paymentStatus, 'Success')) in ('success', 'completed')
              and (:academicSessionId is null or fp.academicSession.id = :academicSessionId or fp.academicSession is null)
            order by fp.paymentDate desc nulls last, fp.createdAt desc
            """)
    List<FeePayment> findCompletedStudentPayments(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select coalesce(sum(fp.paidAmount), 0)
            from FeePayment fp
            where fp.institute.id = :instituteId
              and lower(coalesce(fp.paymentStatus, 'Success')) in ('success', 'completed')
              and (:academicSessionId is null or fp.academicSession.id = :academicSessionId or fp.academicSession is null)
            """)
    java.math.BigDecimal sumCompletedPayments(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select coalesce(sum(fp.paidAmount), 0)
            from FeePayment fp
            where fp.institute.id = :instituteId
              and lower(coalesce(fp.paymentStatus, 'Success')) in ('success', 'completed')
              and fp.paymentDate = current_date
              and (:academicSessionId is null or fp.academicSession.id = :academicSessionId or fp.academicSession is null)
            """)
    java.math.BigDecimal sumTodayCollections(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select coalesce(sum(fp.paidAmount), 0)
            from FeePayment fp
            where fp.institute.id = :instituteId
              and lower(coalesce(fp.paymentStatus, 'Success')) in ('success', 'completed')
              and year(fp.paymentDate) = year(current_date)
              and month(fp.paymentDate) = month(current_date)
              and (:academicSessionId is null or fp.academicSession.id = :academicSessionId or fp.academicSession is null)
            """)
    java.math.BigDecimal sumMonthCollections(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    Optional<FeePayment> findByInstituteIdAndIdempotencyKey(Long instituteId, String idempotencyKey);

    boolean existsByInstituteIdAndTransactionIdIgnoreCaseAndPaymentStatusIn(Long instituteId, String transactionId, List<String> statuses);

    long countByInstituteIdAndStructureId(Long instituteId, String structureId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select fp from FeePayment fp where fp.institute.id = :instituteId and fp.studentId = :studentId")
    List<FeePayment> lockStudentPayments(@Param("instituteId") Long instituteId, @Param("studentId") Long studentId);

    @Query(
            value = """
                    select new com.erp.backend.fee.dto.FeeReceiptSearchResponse(
                        fp.id,
                        s.id,
                        s.enrollmentNo,
                        coalesce(nullif(trim(concat(coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''))), ''), coalesce(s.name, s.enrollmentNo)),
                        coalesce(s.className, s.assignedClass),
                        s.section,
                        fp.receiptNumber,
                        fp.transactionId,
                        fp.mode,
                        fp.paymentStatus,
                        fp.paidAmount,
                        fp.balanceRemaining,
                        fp.paymentDate,
                        'UNKNOWN'
                    )
                    from FeePayment fp
                    join Student s on s.id = fp.studentId and s.institute.id = fp.institute.id
                    where fp.institute.id = :instituteId
                      and (:academicSessionId is null or fp.academicSession.id = :academicSessionId or fp.academicSession is null)
                      and (:mode = '' or lower(coalesce(fp.mode, '')) = lower(:mode))
                      and (:status = '' or lower(coalesce(fp.paymentStatus, '')) = lower(:status))
                      and (:search = '' or lower(concat(coalesce(fp.receiptNumber, ''), ' ', coalesce(fp.transactionId, ''), ' ', coalesce(s.enrollmentNo, ''), ' ', coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''), ' ', coalesce(s.name, ''))) like lower(concat('%', :search, '%')))
                    order by fp.paymentDate desc nulls last, fp.createdAt desc
                    """,
            countQuery = """
                    select count(fp)
                    from FeePayment fp
                    join Student s on s.id = fp.studentId and s.institute.id = fp.institute.id
                    where fp.institute.id = :instituteId
                      and (:academicSessionId is null or fp.academicSession.id = :academicSessionId or fp.academicSession is null)
                      and (:mode = '' or lower(coalesce(fp.mode, '')) = lower(:mode))
                      and (:status = '' or lower(coalesce(fp.paymentStatus, '')) = lower(:status))
                      and (:search = '' or lower(concat(coalesce(fp.receiptNumber, ''), ' ', coalesce(fp.transactionId, ''), ' ', coalesce(s.enrollmentNo, ''), ' ', coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''), ' ', coalesce(s.name, ''))) like lower(concat('%', :search, '%')))
                    """
    )
    Page<FeeReceiptSearchResponse> findReceipts(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("search") String search,
            @Param("mode") String mode,
            @Param("status") String status,
            Pageable pageable
    );

    Optional<FeePayment> findByInstituteIdAndId(Long instituteId, Long id);
}
