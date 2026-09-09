package com.erp.backend.timetable.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.timetable.entity.ClassTimetable;
import com.erp.backend.timetable.dto.TimetableRecordSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassTimetableRepository extends JpaRepository<ClassTimetable, Long> {
    List<ClassTimetable> findAllByInstituteIdOrderByClassNameAsc(Long instituteId);

    Optional<ClassTimetable> findByInstituteIdAndId(Long instituteId, Long id);

    List<ClassTimetable> findAllByInstituteIdAndAcademicSessionId(Long instituteId, Long academicSessionId);

    @Query("""
            select t
            from ClassTimetable t
            join fetch t.schoolClass c
            left join fetch t.section s
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.attendanceTeacher.id = :teacherId
              and upper(coalesce(t.status, 'PUBLISHED')) = 'PUBLISHED'
            order by c.name asc, s.name asc
            """)
    List<ClassTimetable> findAttendanceTeacherAssignments(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId
    );

    @Query("""
            select count(t) > 0
            from ClassTimetable t
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.attendanceTeacher.id = :teacherId
              and t.schoolClass.id = :classId
              and (:sectionId is null and t.section is null or t.section.id = :sectionId)
              and upper(coalesce(t.status, 'PUBLISHED')) = 'PUBLISHED'
            """)
    boolean existsAttendanceTeacherAssignment(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId,
            @Param("classId") Long classId,
            @Param("sectionId") Long sectionId
    );

    @Query("""
            select new com.erp.backend.timetable.dto.TimetableRecordSummary(
                t.id,
                t.academicSession.id,
                t.schoolClass.id,
                t.section.id,
                t.updatedAt,
                t.status
            )
            from ClassTimetable t
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.schoolClass is not null
              and (t.templateDataJson is not null or t.fileData is not null)
            """)
    List<TimetableRecordSummary> findRecordSummaries(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    Optional<ClassTimetable> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionId(
            Long instituteId,
            Long academicSessionId,
            Long schoolClassId,
            Long sectionId
    );

    Optional<ClassTimetable> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionIsNull(
            Long instituteId,
            Long academicSessionId,
            Long schoolClassId
    );

    @Query("""
            select t
            from ClassTimetable t
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.schoolClass.id = :classId
              and (:sectionId is null and t.section is null or t.section.id = :sectionId)
              and (t.templateDataJson is not null or t.fileData is not null)
            """)
    Optional<ClassTimetable> findStructured(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("sectionId") Long sectionId
    );

    @Query("""
            select new com.erp.backend.timetable.dto.TimetableRecordSummary(
                t.id,
                t.academicSession.id,
                t.schoolClass.id,
                t.section.id,
                t.updatedAt,
                t.status
            )
            from ClassTimetable t
            where t.institute.id = :instituteId
              and (t.templateDataJson is not null or t.fileData is not null)
            """)
    List<TimetableRecordSummary> findSummaries(@Param("instituteId") Long instituteId);
}
