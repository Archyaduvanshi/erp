package com.erp.backend.timetable.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.timetable.entity.TimetableTemplateDraft;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimetableTemplateDraftRepository extends JpaRepository<TimetableTemplateDraft, Long> {
    List<TimetableTemplateDraft> findAllByInstituteIdOrderByClassNameAsc(Long instituteId);

    Optional<TimetableTemplateDraft> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<TimetableTemplateDraft> findByInstituteIdAndClassNameIgnoreCase(Long instituteId, String className);
}
