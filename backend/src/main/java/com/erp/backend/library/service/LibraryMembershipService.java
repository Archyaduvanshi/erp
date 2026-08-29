package com.erp.backend.library.service;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.erp.backend.institute.entity.Institute;
import com.erp.backend.library.entity.LibraryMembership;
import com.erp.backend.library.repository.LibraryMembershipRepository;
import com.erp.backend.student.entity.Student;

@Service
public class LibraryMembershipService {

    @Autowired
    private LibraryMembershipRepository libraryMembershipRepository;

    /**
     * Create a new library membership for a student
     */
    public LibraryMembership createMembership(Student student, Institute institute, String membershipType, 
                                             BigDecimal monthlyCharge, String remarks) {
        LibraryMembership membership = new LibraryMembership();
        membership.setStudent(student);
        membership.setInstitute(institute);
        membership.setMembershipType(membershipType);
        membership.setMonthlyCharge(monthlyCharge);
        membership.setRemarks(remarks);
        membership.setStatus("active");
        membership.setEnrollmentMonth(YearMonth.now().toString());
        membership.setEnrollmentYear(String.valueOf(YearMonth.now().getYear()));
        return libraryMembershipRepository.save(membership);
    }

    /**
     * Get active membership for a student
     */
    public Optional<LibraryMembership> getActiveLibraryMembership(Long instituteId, Long studentId) {
        return libraryMembershipRepository.findByInstituteIdAndStudentIdAndStatus(instituteId, studentId, "active");
    }

    /**
     * Get all memberships for a student
     */
    public List<LibraryMembership> getStudentMemberships(Long instituteId, Long studentId) {
        return libraryMembershipRepository.findByInstituteIdAndStudentId(instituteId, studentId).stream().toList();
    }

    /**
     * Get membership by student entity
     */
    public Optional<LibraryMembership> getMembershipByStudent(Student student) {
        return libraryMembershipRepository.findByStudent(student);
    }

    /**
     * Update membership status
     */
    public LibraryMembership updateMembershipStatus(Long instituteId, Long membershipId, String status) {
        Optional<LibraryMembership> membership = libraryMembershipRepository.findByInstituteIdAndId(instituteId, membershipId);
        if (membership.isPresent()) {
            LibraryMembership m = membership.get();
            m.setStatus(status);
            return libraryMembershipRepository.save(m);
        }
        throw new RuntimeException("Membership not found with ID: " + membershipId);
    }

    /**
     * Update monthly charge for membership
     */
    public LibraryMembership updateMonthlyCharge(Long instituteId, Long membershipId, BigDecimal monthlyCharge) {
        Optional<LibraryMembership> membership = libraryMembershipRepository.findByInstituteIdAndId(instituteId, membershipId);
        if (membership.isPresent()) {
            LibraryMembership m = membership.get();
            m.setMonthlyCharge(monthlyCharge);
            return libraryMembershipRepository.save(m);
        }
        throw new RuntimeException("Membership not found with ID: " + membershipId);
    }

    /**
     * Get all active memberships in an institute
     */
    public List<LibraryMembership> getActiveInstituteMembers(Long instituteId) {
        return libraryMembershipRepository.findByInstituteIdAndStatus(instituteId, "active");
    }

    /**
     * Suspend a membership
     */
    public LibraryMembership suspendMembership(Long instituteId, Long membershipId) {
        return updateMembershipStatus(instituteId, membershipId, "suspended");
    }

    /**
     * Deactivate a membership
     */
    public LibraryMembership deactivateMembership(Long instituteId, Long membershipId) {
        return updateMembershipStatus(instituteId, membershipId, "inactive");
    }

    /**
     * Activate a membership
     */
    public LibraryMembership activateMembership(Long instituteId, Long membershipId) {
        return updateMembershipStatus(instituteId, membershipId, "active");
    }

    /**
     * Delete a membership
     */
    public void deleteMembership(Long instituteId, Long membershipId) {
        deactivateMembership(instituteId, membershipId);
    }

    /**
     * Get membership by ID
     */
    public Optional<LibraryMembership> getMembershipById(Long instituteId, Long membershipId) {
        return libraryMembershipRepository.findByInstituteIdAndId(instituteId, membershipId);
    }

    /**
     * Update membership remarks
     */
    public LibraryMembership updateMembershipRemarks(Long instituteId, Long membershipId, String remarks) {
        Optional<LibraryMembership> membership = libraryMembershipRepository.findByInstituteIdAndId(instituteId, membershipId);
        if (membership.isPresent()) {
            LibraryMembership m = membership.get();
            m.setRemarks(remarks);
            return libraryMembershipRepository.save(m);
        }
        throw new RuntimeException("Membership not found with ID: " + membershipId);
    }
}
