package com.erp.backend.library.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.erp.backend.library.entity.LibraryMembership;
import com.erp.backend.student.entity.Student;

@Repository
public interface LibraryMembershipRepository extends JpaRepository<LibraryMembership, Long> {
    
    Optional<LibraryMembership> findByStudentIdAndStatus(Long studentId, String status);

    Optional<LibraryMembership> findByInstituteIdAndStudentIdAndStatus(Long instituteId, Long studentId, String status);

    Optional<LibraryMembership> findByInstituteIdAndStudentId(Long instituteId, Long studentId);

    Optional<LibraryMembership> findByInstituteIdAndId(Long instituteId, Long id);
    
    List<LibraryMembership> findByStudentId(Long studentId);
    
    List<LibraryMembership> findByInstituteIdAndStatus(Long instituteId, String status);
    
    Optional<LibraryMembership> findByStudent(Student student);
    
    List<LibraryMembership> findByStatusAndMembershipType(String status, String membershipType);
}
