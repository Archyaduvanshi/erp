package com.erp.backend.timetable.repository;

import java.time.LocalTime;
import java.util.Collection;
import java.util.List;

import com.erp.backend.timetable.dto.TimetablePeriodProjection;
import com.erp.backend.timetable.entity.TimetablePeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TimetablePeriodRepository extends JpaRepository<TimetablePeriod, Long> {

    void deleteAllByTimetableId(Long timetableId);

    List<TimetablePeriod> findAllByTimetableIdOrderByDayOfWeekAscPeriodNumberAsc(Long timetableId);

    @Query("""
            select p
            from TimetablePeriod p
            join fetch p.timetable t
            join fetch t.schoolClass c
            left join fetch t.section s
            join fetch p.classSubject cs
            join fetch cs.subject sub
            join fetch p.teacher teacher
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and p.teacher.id = :teacherId
            order by p.dayOfWeek asc, p.startTime asc
            """)
    List<TimetablePeriod> findTeacherPeriods(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId
    );

    @Query("""
            select new com.erp.backend.timetable.dto.TimetablePeriodProjection(
                p.id,
                t.id,
                teacher.id,
                p.dayOfWeek,
                p.periodNumber,
                p.startTime,
                p.endTime,
                c.id,
                c.name,
                s.id,
                s.name,
                cs.id,
                sub.id,
                sub.name,
                coalesce(nullif(trim(concat(coalesce(teacher.firstName, ''), ' ', coalesce(teacher.lastName, ''))), ''), coalesce(teacher.name, 'Teacher')),
                teacher.employeeId
            )
            from TimetablePeriod p
            join p.timetable t
            join t.schoolClass c
            left join t.section s
            join p.classSubject cs
            join cs.subject sub
            join p.teacher teacher
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.status = 'PUBLISHED'
              and p.teacher.id = :teacherId
            order by p.dayOfWeek asc, p.startTime asc
            """)
    List<TimetablePeriodProjection> findTeacherPeriodProjections(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId
    );

    @Query("""
            select count(p) > 0
            from TimetablePeriod p
            join p.timetable t
            join p.classSubject cs
            join cs.subject sub
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.status = 'PUBLISHED'
              and p.teacher.id = :teacherId
              and t.schoolClass.id = :classId
              and sub.id = :subjectId
            """)
    boolean existsPublishedTeacherSubjectAssignment(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId,
            @Param("classId") Long classId,
            @Param("subjectId") Long subjectId
    );

    @Query("""
            select new com.erp.backend.timetable.dto.TimetablePeriodProjection(
                p.id,
                t.id,
                teacher.id,
                p.dayOfWeek,
                p.periodNumber,
                p.startTime,
                p.endTime,
                c.id,
                c.name,
                s.id,
                s.name,
                cs.id,
                sub.id,
                sub.name,
                coalesce(nullif(trim(concat(coalesce(teacher.firstName, ''), ' ', coalesce(teacher.lastName, ''))), ''), coalesce(teacher.name, 'Teacher')),
                teacher.employeeId
            )
            from TimetablePeriod p
            join p.timetable t
            join t.schoolClass c
            left join t.section s
            join p.classSubject cs
            join cs.subject sub
            join p.teacher teacher
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.status = 'PUBLISHED'
            order by teacher.id asc, p.dayOfWeek asc, p.startTime asc
            """)
    List<TimetablePeriodProjection> findOccupancyProjections(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select p
            from TimetablePeriod p
            join fetch p.timetable t
            join fetch t.schoolClass c
            left join fetch t.section s
            join fetch p.teacher teacher
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and p.teacher.id = :teacherId
              and p.dayOfWeek = :dayOfWeek
              and p.startTime < :endTime
              and p.endTime > :startTime
              and (:ignoreTimetableId is null or t.id <> :ignoreTimetableId)
            """)
    List<TimetablePeriod> findTeacherConflicts(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId,
            @Param("dayOfWeek") String dayOfWeek,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime,
            @Param("ignoreTimetableId") Long ignoreTimetableId
    );

    @Query("""
            select new com.erp.backend.timetable.dto.TimetablePeriodProjection(
                p.id,
                t.id,
                teacher.id,
                p.dayOfWeek,
                p.periodNumber,
                p.startTime,
                p.endTime,
                c.id,
                c.name,
                s.id,
                s.name,
                cs.id,
                sub.id,
                sub.name,
                coalesce(nullif(trim(concat(coalesce(teacher.firstName, ''), ' ', coalesce(teacher.lastName, ''))), ''), coalesce(teacher.name, 'Teacher')),
                teacher.employeeId
            )
            from TimetablePeriod p
            join p.timetable t
            join t.schoolClass c
            left join t.section s
            join p.classSubject cs
            join cs.subject sub
            join p.teacher teacher
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.status = 'PUBLISHED'
              and p.teacher.id in :teacherIds
              and (:ignoreTimetableId is null or t.id <> :ignoreTimetableId)
            order by teacher.id asc, p.dayOfWeek asc, p.startTime asc
            """)
    List<TimetablePeriodProjection> findTeacherConflictProjections(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherIds") Collection<Long> teacherIds,
            @Param("ignoreTimetableId") Long ignoreTimetableId
    );

    @Query("""
            select p
            from TimetablePeriod p
            join fetch p.timetable t
            join fetch t.schoolClass c
            left join fetch t.section s
            join fetch p.classSubject cs
            join fetch cs.subject sub
            join fetch p.teacher teacher
            where t.institute.id = :instituteId
              and t.academicSession.id = :academicSessionId
              and t.schoolClass.id = :classId
              and (:sectionId is null and t.section is null or t.section.id = :sectionId)
            order by p.dayOfWeek asc, p.periodNumber asc
            """)
    List<TimetablePeriod> findClassPeriods(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("sectionId") Long sectionId
    );
}
