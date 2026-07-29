package com.erp.backend.student.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.student.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRepository extends JpaRepository<Student, Long> {

    List<Student> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    List<Student> findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByFirstNameAscLastNameAscCreatedAtAsc(Long instituteId, String assignedClass);

    Optional<Student> findByInstituteIdAndId(Long instituteId, Long id);

    List<Student> findAllByInstituteIdAndIdIn(Long instituteId, List<Long> ids);

    List<Student> findAllBySystemIdIgnoreCaseOrEnrollmentNoIgnoreCaseOrMobile(String systemId, String enrollmentNo, String mobile);

    boolean existsByInstituteIdAndEmailIgnoreCase(Long instituteId, String email);

    long countByInstituteId(Long instituteId);
}
