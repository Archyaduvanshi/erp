package com.erp.backend.teacher.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.teacher.entity.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeacherRepository extends JpaRepository<Teacher, Long> {

    List<Teacher> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<Teacher> findByInstituteIdAndId(Long instituteId, Long id);

    List<Teacher> findAllByTeacherSystemIdIgnoreCaseOrEmployeeIdIgnoreCaseOrMobileNumber(String teacherSystemId, String employeeId, String mobileNumber);

    long countByInstituteId(Long instituteId);
}
