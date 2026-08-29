package com.erp.backend.fee.repository;

import java.util.List;

import com.erp.backend.fee.entity.StudentFeeCharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudentFeeChargeRepository extends JpaRepository<StudentFeeCharge, Long> {

    List<StudentFeeCharge> findAllByInstituteIdAndStudentId(Long instituteId, Long studentId);

    boolean existsByInstituteIdAndFeeStructureId(Long instituteId, Long feeStructureId);

    @Query("""
            select c.student.id, c.feeStructure.id, coalesce(c.periodKey, '')
            from StudentFeeCharge c
            where c.institute.id = :instituteId
              and c.feeStructure.id = :feeStructureId
              and c.student.id in :studentIds
              and lower(coalesce(c.status, 'OPEN')) <> 'archived'
            """)
    List<Object[]> findExistingKeysForStructureAndStudents(
            @Param("instituteId") Long instituteId,
            @Param("feeStructureId") Long feeStructureId,
            @Param("studentIds") List<Long> studentIds
    );

    @Query("""
            select c.feeStructure.id, coalesce(c.periodKey, '')
            from StudentFeeCharge c
            where c.institute.id = :instituteId
              and c.student.id = :studentId
              and c.feeStructure.id in :feeStructureIds
              and lower(coalesce(c.status, 'OPEN')) <> 'archived'
            """)
    List<Object[]> findExistingKeysForStudentAndStructures(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("feeStructureIds") List<Long> feeStructureIds
    );

    @Query("""
            select c
            from StudentFeeCharge c
            where c.institute.id = :instituteId
              and c.student.id = :studentId
              and lower(coalesce(c.status, 'OPEN')) = 'open'
              and (:academicSessionId is null or c.academicSession is null or c.academicSession.id = :academicSessionId)
            order by c.dueDate asc nulls last, c.createdAt asc
            """)
    List<StudentFeeCharge> findOpenChargesForStudent(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select coalesce(sum(c.amount), 0)
            from StudentFeeCharge c
            where c.institute.id = :instituteId
              and lower(coalesce(c.status, 'OPEN')) = 'open'
              and (:academicSessionId is null or c.academicSession is null or c.academicSession.id = :academicSessionId)
            """)
    java.math.BigDecimal sumOpenCharges(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );
}
