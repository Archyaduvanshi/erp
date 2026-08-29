package com.erp.backend.fee.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.fee.entity.FeeStructure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeeStructureRepository extends JpaRepository<FeeStructure, Long> {

    List<FeeStructure> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    @Query("""
            select fs
            from FeeStructure fs
            where fs.institute.id = :instituteId
              and (:academicSessionId is null or fs.academicSession.id = :academicSessionId or fs.academicSession is null)
              and (:className = '' or lower(fs.courseId) = lower(:className))
              and (:category = '' or lower(coalesce(fs.category, '')) = lower(:category))
              and lower(coalesce(fs.status, 'ACTIVE')) <> 'archived'
            order by fs.courseId asc, fs.feeComponent asc
            """)
    List<FeeStructure> findActiveStructures(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("className") String className,
            @Param("category") String category
    );

    @Query("""
            select distinct fs.courseId
            from FeeStructure fs
            where fs.institute.id = :instituteId
              and (:academicSessionId is null or fs.academicSession.id = :academicSessionId or fs.academicSession is null)
              and fs.courseId is not null
              and lower(coalesce(fs.status, 'ACTIVE')) <> 'archived'
            """)
    List<String> findDistinctStructureClasses(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    boolean existsByInstituteIdAndId(Long instituteId, Long id);

    Optional<FeeStructure> findByInstituteIdAndId(Long instituteId, Long id);
}
