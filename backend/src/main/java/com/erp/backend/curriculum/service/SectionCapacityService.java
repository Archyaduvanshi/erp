package com.erp.backend.curriculum.service;

import com.erp.backend.curriculum.entity.ClassSection;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.repository.ClassSectionRepository;
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.student.repository.StudentRepository;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SectionCapacityService {

    private static final int DEFAULT_SECTION_CAPACITY = 30;

    private final ClassSectionRepository classSectionRepository;
    private final StudentRepository studentRepository;

    public SectionCapacityService(ClassSectionRepository classSectionRepository, StudentRepository studentRepository) {
        this.classSectionRepository = classSectionRepository;
        this.studentRepository = studentRepository;
    }

    public ClassSection lockAndValidateAvailableSeat(Long instituteId, SchoolClass schoolClass, Long sectionId, String sectionName, Long currentStudentId) {
        if (schoolClass == null) {
            throw new FieldValidationException("CLASS_NOT_FOUND: Class is required.", Map.of("className", "Class is required."));
        }

        ClassSection section = resolveAndLockSection(instituteId, schoolClass.getId(), sectionId, sectionName);
        if ("ARCHIVED".equalsIgnoreCase(section.getStatus()) || "INACTIVE".equalsIgnoreCase(section.getStatus())) {
            throw new FieldValidationException("SECTION_NOT_FOUND: Section is not active.", Map.of("section", "Section is not active."));
        }

        long activeStudents = currentStudentId == null
                ? studentRepository.countSeatConsumingByInstituteIdAndSectionId(instituteId, section.getId())
                : studentRepository.countSeatConsumingByInstituteIdAndSectionIdExcludingStudent(instituteId, section.getId(), currentStudentId);
        int capacity = normalizeCapacity(section.getMaxStudents());
        if (activeStudents >= capacity) {
            throw new FieldValidationException("SECTION_FULL: Section is full.", Map.of(
                    "section", section.getName() + " is full (" + activeStudents + "/" + capacity + ")."
            ));
        }
        return section;
    }

    public void validateCapacityChange(Long instituteId, Long sectionId, Integer nextCapacity) {
        int capacity = normalizeCapacity(nextCapacity);
        long activeStudents = studentRepository.countSeatConsumingByInstituteIdAndSectionId(instituteId, sectionId);
        if (capacity < activeStudents) {
            throw new FieldValidationException("SECTION_CAPACITY_BELOW_CURRENT_ENROLLMENT", Map.of(
                    "maxStudents", "Capacity cannot be lower than current students (" + activeStudents + ")."
            ));
        }
    }

    public int normalizeCapacity(Integer maxStudents) {
        if (maxStudents == null) return DEFAULT_SECTION_CAPACITY;
        if (maxStudents < 1) {
            throw new FieldValidationException("INVALID_CAPACITY: Section capacity must be greater than zero.", Map.of("maxStudents", "Capacity must be greater than zero."));
        }
        return maxStudents;
    }

    private ClassSection resolveAndLockSection(Long instituteId, Long classId, Long sectionId, String sectionName) {
        ClassSection section;
        if (sectionId != null) {
            section = classSectionRepository.findByInstituteIdAndIdForUpdate(instituteId, sectionId)
                    .orElseThrow(() -> new ResourceNotFoundException("SECTION_NOT_FOUND: Section not found."));
            if (section.getSchoolClass() == null || !section.getSchoolClass().getId().equals(classId)) {
                throw new FieldValidationException("SECTION_DOES_NOT_BELONG_TO_CLASS", Map.of("section", "Section does not belong to selected class."));
            }
            return section;
        }
        if (!StringUtils.hasText(sectionName)) {
            throw new FieldValidationException("SECTION_NOT_FOUND: Section is required.", Map.of("section", "Section is required."));
        }
        String normalizedName = CurriculumService.normalizeKeyStatic(sectionName);
        return classSectionRepository.findByInstituteIdAndSchoolClassIdAndNormalizedName(instituteId, classId, normalizedName)
                .flatMap(row -> classSectionRepository.findByInstituteIdAndIdForUpdate(instituteId, row.getId()))
                .orElseThrow(() -> new FieldValidationException("SECTION_NOT_FOUND: Select a valid section from Curriculum.", Map.of("section", "Select a valid section.")));
    }
}
