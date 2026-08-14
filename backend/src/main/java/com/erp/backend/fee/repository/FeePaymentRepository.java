package com.erp.backend.fee.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.fee.entity.FeePayment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeePaymentRepository extends JpaRepository<FeePayment, Long> {

    List<FeePayment> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    List<FeePayment> findAllByInstituteIdAndStudentIdOrderByCreatedAtDesc(Long instituteId, Long studentId);

    Optional<FeePayment> findByInstituteIdAndId(Long instituteId, Long id);
}
