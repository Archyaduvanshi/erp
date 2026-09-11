package com.erp.backend.report.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FeeReportService {

    private final EntityManager entityManager;

    public FeeReportService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(Long instituteId, Long academicSessionId) {
        Object[] row = (Object[]) entityManager.createNativeQuery("""
                select
                  coalesce((select sum(c.amount)
                            from student_fee_charges c
                            where c.institute_id = :instituteId
                              and lower(coalesce(c.status, 'OPEN')) = 'open'
                              and (cast(:academicSessionId as bigint) is null or c.academic_session_id = cast(:academicSessionId as bigint) or c.academic_session_id is null)), 0) as total_charged,
                  coalesce((select sum(a.amount)
                            from fee_payment_allocations a
                            join fee_payments fp on fp.id = a.payment_id
                            where a.institute_id = :instituteId
                              and lower(coalesce(fp.payment_status, '')) in ('completed', 'success')
                              and (cast(:academicSessionId as bigint) is null or a.academic_session_id = cast(:academicSessionId as bigint) or a.academic_session_id is null)), 0) as collected,
                  coalesce((select count(*)
                            from fee_payments fp
                            where fp.institute_id = :instituteId
                              and (cast(:academicSessionId as bigint) is null or fp.academic_session_id = cast(:academicSessionId as bigint) or fp.academic_session_id is null)), 0) as payment_count
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", academicSessionId)
                .getSingleResult();
        return Map.of("totalCharged", row[0], "totalCollected", row[1], "paymentCount", row[2]);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> collections(Long instituteId, Long academicSessionId, LocalDate dateFrom, LocalDate dateTo, String groupBy) {
        String bucketExpression = "mode".equalsIgnoreCase(groupBy)
                ? "coalesce(mode, 'Unknown')"
                : "date".equalsIgnoreCase(groupBy)
                ? "to_char(payment_date, 'YYYY-MM-DD')"
                : "to_char(date_trunc('month', payment_date), 'YYYY-MM')";
        List<Object[]> rows = entityManager.createNativeQuery("""
                select %s as bucket, coalesce(sum(paid_amount), 0) as amount, count(*) as payment_count
                from fee_payments
                where institute_id = :instituteId
                  and lower(coalesce(payment_status, 'completed')) in ('completed', 'success')
                  and (:academicSessionId is null or academic_session_id = :academicSessionId or academic_session_id is null)
                  and (:dateFrom is null or payment_date >= :dateFrom)
                  and (:dateTo is null or payment_date <= :dateTo)
                group by bucket
                order by bucket
                """.formatted(bucketExpression))
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", academicSessionId)
                .setParameter("dateFrom", dateFrom)
                .setParameter("dateTo", dateTo)
                .getResultList();
        return rows.stream()
                .map(row -> Map.of("bucket", row[0], "amount", row[1], "paymentCount", row[2]))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> outstanding(Long instituteId, Long academicSessionId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                select coalesce(s.class_name, split_part(coalesce(s.assigned_class, ''), '/', 1), 'Unassigned') as class_name,
                       coalesce(sum(c.amount), 0) as expected,
                       coalesce((
                         select sum(a.amount)
                         from fee_payment_allocations a
                         join fee_payments fp on fp.id = a.payment_id
                         join students ps on ps.id = a.student_id and ps.institute_id = a.institute_id
                         where a.institute_id = c.institute_id
                           and lower(coalesce(fp.payment_status, '')) in ('completed', 'success')
                           and (:academicSessionId is null or a.academic_session_id = :academicSessionId or a.academic_session_id is null)
                           and coalesce(ps.class_name, split_part(coalesce(ps.assigned_class, ''), '/', 1), 'Unassigned')
                               = coalesce(s.class_name, split_part(coalesce(s.assigned_class, ''), '/', 1), 'Unassigned')
                       ), 0) as paid
                from student_fee_charges c
                join students s on s.id = c.student_id and s.institute_id = c.institute_id
                where c.institute_id = :instituteId
                  and lower(coalesce(c.status, 'OPEN')) = 'open'
                  and (:academicSessionId is null or c.academic_session_id = :academicSessionId or c.academic_session_id is null)
                group by c.institute_id, class_name
                order by class_name
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", academicSessionId)
                .getResultList();
        return rows.stream()
                .map(row -> Map.of("className", row[0], "expected", row[1], "paid", row[2], "outstanding", ((java.math.BigDecimal) row[1]).subtract((java.math.BigDecimal) row[2]).max(java.math.BigDecimal.ZERO)))
                .toList();
    }
}
