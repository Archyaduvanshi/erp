package com.erp.backend.salary.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.salary.entity.TeacherSalaryPayment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeacherSalaryPaymentRepository extends JpaRepository<TeacherSalaryPayment, Long> {

    List<TeacherSalaryPayment> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    List<TeacherSalaryPayment> findAllByInstituteIdAndTeacherIdOrderByMonthKeyDesc(Long instituteId, Long teacherId);

    Optional<TeacherSalaryPayment> findByInstituteIdAndTeacherIdAndMonthKey(Long instituteId, Long teacherId, String monthKey);
}
