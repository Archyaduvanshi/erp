package com.erp.backend.timetable.service;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.ClassSection;
import com.erp.backend.curriculum.entity.ClassSubject;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.repository.ClassSubjectRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.timetable.dto.TimetablePeriodCandidate;
import com.erp.backend.timetable.dto.TimetablePeriodProjection;
import com.erp.backend.timetable.repository.TimetablePeriodRepository;
import org.springframework.stereotype.Component;

@Component
public class TimetableValidator {

    private final ClassSubjectRepository classSubjectRepository;
    private final TeacherRepository teacherRepository;
    private final TimetablePeriodRepository timetablePeriodRepository;

    public TimetableValidator(
            ClassSubjectRepository classSubjectRepository,
            TeacherRepository teacherRepository,
            TimetablePeriodRepository timetablePeriodRepository
    ) {
        this.classSubjectRepository = classSubjectRepository;
        this.teacherRepository = teacherRepository;
        this.timetablePeriodRepository = timetablePeriodRepository;
    }

    public List<ResolvedTimetablePeriod> validatePublish(
            Long instituteId,
            AcademicSession academicSession,
            SchoolClass schoolClass,
            ClassSection section,
            List<TimetablePeriodCandidate> periods,
            Long ignoreTimetableId
    ) {
        if (academicSession == null || !academicSession.getInstitute().getId().equals(instituteId)) {
            throw new IllegalArgumentException("Academic session does not belong to the institute.");
        }
        if (schoolClass == null || !schoolClass.getInstitute().getId().equals(instituteId)) {
            throw new IllegalArgumentException("Class does not belong to the institute.");
        }
        if (section != null && (!section.getInstitute().getId().equals(instituteId) || !section.getSchoolClass().getId().equals(schoolClass.getId()))) {
            throw new IllegalArgumentException("Section does not belong to the selected class.");
        }
        if (periods == null || periods.isEmpty()) {
            throw new IllegalArgumentException("Please assign at least one timetable period before publishing.");
        }

        Set<String> cellKeys = new HashSet<>();
        for (TimetablePeriodCandidate period : periods) {
            validatePeriodShape(period);
            String cellKey = period.dayOfWeek() + ":" + period.periodNumber();
            if (!cellKeys.add(cellKey)) {
                throw new IllegalArgumentException("Duplicate timetable period found for " + period.dayOfWeek() + " period " + period.periodNumber() + ".");
            }
        }

        Set<Long> classSubjectIds = periods.stream()
                .map(TimetablePeriodCandidate::classSubjectId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> teacherIds = periods.stream()
                .map(TimetablePeriodCandidate::teacherId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<Long, ClassSubject> subjectsById = classSubjectRepository.findAllByInstituteIdAndIdIn(instituteId, classSubjectIds)
                .stream()
                .collect(Collectors.toMap(ClassSubject::getId, subject -> subject, (left, right) -> left, LinkedHashMap::new));
        Map<Long, Teacher> teachersById = teacherRepository.lockAllByInstituteIdAndIdIn(instituteId, teacherIds)
                .stream()
                .collect(Collectors.toMap(Teacher::getId, teacher -> teacher, (left, right) -> left, LinkedHashMap::new));

        List<ResolvedTimetablePeriod> resolvedPeriods = periods.stream()
                .map(period -> resolvePeriod(academicSession, schoolClass, subjectsById, teachersById, period))
                .toList();

        Map<Long, List<TimetablePeriodProjection>> existingByTeacher = teacherIds.isEmpty()
                ? Map.of()
                : timetablePeriodRepository.findTeacherConflictProjections(instituteId, academicSession.getId(), teacherIds, ignoreTimetableId)
                        .stream()
                        .collect(Collectors.groupingBy(TimetablePeriodProjection::teacherId, LinkedHashMap::new, Collectors.toList()));

        for (ResolvedTimetablePeriod period : resolvedPeriods) {
            for (TimetablePeriodProjection conflict : existingByTeacher.getOrDefault(period.teacher().getId(), List.of())) {
                if (hasTimeConflict(period, conflict)) {
                    String className = conflict.sectionId() == null
                            ? conflict.className()
                            : conflict.className() + " / " + conflict.sectionName();
                    throw new IllegalArgumentException("Teacher already assigned to " + className + " on " + period.dayOfWeek() + " during " + period.startTime() + "-" + period.endTime() + ".");
                }
            }
        }

        return resolvedPeriods;
    }

    private void validatePeriodShape(TimetablePeriodCandidate period) {
        if (period.periodNumber() == null || period.periodNumber() < 1) {
            throw new IllegalArgumentException("Invalid period number.");
        }
        if (period.startTime() == null || period.endTime() == null || !period.startTime().isBefore(period.endTime())) {
            throw new IllegalArgumentException("Invalid period timing for " + period.dayOfWeek() + " period " + period.periodNumber() + ".");
        }
        if (period.classSubjectId() == null) {
            throw new IllegalArgumentException("Please select subject from the subject dropdown for " + period.dayOfWeek() + " period " + period.periodNumber() + ".");
        }
        if (period.teacherId() == null) {
            throw new IllegalArgumentException("Please select teacher from the teacher dropdown for " + period.dayOfWeek() + " period " + period.periodNumber() + ".");
        }
    }

    private ResolvedTimetablePeriod resolvePeriod(
            AcademicSession academicSession,
            SchoolClass schoolClass,
            Map<Long, ClassSubject> subjectsById,
            Map<Long, Teacher> teachersById,
            TimetablePeriodCandidate period
    ) {
        ClassSubject classSubject = subjectsById.get(period.classSubjectId());
        if (classSubject == null) {
            throw new ResourceNotFoundException("Class subject not found with id: " + period.classSubjectId());
        }
        if (!classSubject.getAcademicSession().getId().equals(academicSession.getId())
                || !classSubject.getSchoolClass().getId().equals(schoolClass.getId())) {
            throw new IllegalArgumentException("Subject does not belong to the selected class and academic session.");
        }

        Teacher teacher = teachersById.get(period.teacherId());
        if (teacher == null) {
            throw new ResourceNotFoundException("Teacher not found with id: " + period.teacherId());
        }

        return new ResolvedTimetablePeriod(
                period.dayOfWeek(),
                period.periodNumber(),
                period.startTime(),
                period.endTime(),
                classSubject,
                teacher
        );
    }

    private boolean hasTimeConflict(ResolvedTimetablePeriod candidate, TimetablePeriodProjection existing) {
        return candidate.dayOfWeek().equals(existing.dayOfWeek())
                && existing.startTime().isBefore(candidate.endTime())
                && existing.endTime().isAfter(candidate.startTime());
    }
}
