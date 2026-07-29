package com.erp.backend.timetable.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.timetable.entity.ClassTimetable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassTimetableRepository extends JpaRepository<ClassTimetable, Long> {
    List<ClassTimetable> findAllByInstituteIdOrderByClassNameAsc(Long instituteId);

    Optional<ClassTimetable> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<ClassTimetable> findByInstituteIdAndClassNameIgnoreCase(Long instituteId, String className);
}
