package com.erp.backend.report.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SalaryReportService {

    private final EntityManager entityManager;

    public SalaryReportService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(Long instituteId, String monthKey) {
        Object[] row = (Object[]) entityManager.createNativeQuery("""
                select coalesce(sum(net_payable_amount), 0) as obligation,
                       coalesce(sum(paid_amount), 0) as paid,
                       coalesce(sum(outstanding_amount), 0) as outstanding,
                       count(*) as periods
                from teacher_payroll_periods
                where institute_id = :instituteId
                  and (:monthKey = '' or month_key = :monthKey)
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("monthKey", monthKey == null ? "" : monthKey)
                .getSingleResult();
        return Map.of("obligation", row[0], "paid", row[1], "outstanding", row[2], "periods", row[3]);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> payments(Long instituteId, LocalDate dateFrom, LocalDate dateTo, String groupBy) {
        String bucketExpression = "teacher".equalsIgnoreCase(groupBy)
                ? "coalesce(t.name, trim(concat(coalesce(t.first_name, ''), ' ', coalesce(t.last_name, ''))), 'Teacher')"
                : "to_char(date_trunc('month', p.paid_on), 'YYYY-MM')";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select %s as bucket, coalesce(sum(p.total_amount), 0) as amount, count(*) as payment_count
                from teacher_salary_payments p
                join teachers t on t.id = p.teacher_id and t.institute_id = p.institute_id
                where p.institute_id = :instituteId
                  and lower(coalesce(p.status, 'COMPLETED')) = 'completed'
                  and (:dateFrom is null or p.paid_on >= :dateFrom)
                  and (:dateTo is null or p.paid_on <= :dateTo)
                group by bucket
                order by bucket
                """.formatted(bucketExpression))
                .setParameter("instituteId", instituteId)
                .setParameter("dateFrom", dateFrom)
                .setParameter("dateTo", dateTo)
                .getResultList();
        return rows.stream()
                .map(row -> Map.of("bucket", row[0], "amount", row[1], "paymentCount", row[2]))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> outstanding(Long instituteId, String monthKey) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select p.month_key,
                       p.status,
                       count(*) as periods,
                       coalesce(sum(p.net_payable_amount), 0) as obligation,
                       coalesce(sum(p.paid_amount), 0) as paid,
                       coalesce(sum(p.outstanding_amount), 0) as outstanding
                from teacher_payroll_periods p
                where p.institute_id = :instituteId
                  and (:monthKey = '' or p.month_key = :monthKey)
                group by p.month_key, p.status
                order by p.month_key desc, p.status
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("monthKey", monthKey == null ? "" : monthKey)
                .getResultList();
        return rows.stream()
                .map(row -> Map.of(
                        "monthKey", row[0],
                        "status", row[1],
                        "periods", row[2],
                        "obligation", row[3],
                        "paid", row[4],
                        "outstanding", ((BigDecimal) row[5]).max(BigDecimal.ZERO)
                ))
                .toList();
    }
}
