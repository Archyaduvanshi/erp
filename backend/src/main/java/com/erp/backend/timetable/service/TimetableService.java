package com.erp.backend.timetable.service;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.timetable.dto.ClassTimetablePayload;
import com.erp.backend.timetable.dto.ClassTimetableResponse;
import com.erp.backend.timetable.dto.TimetableTemplateDraftPayload;
import com.erp.backend.timetable.dto.TimetableTemplateDraftResponse;
import com.erp.backend.timetable.entity.ClassTimetable;
import com.erp.backend.timetable.entity.TimetableTemplateDraft;
import com.erp.backend.timetable.repository.ClassTimetableRepository;
import com.erp.backend.timetable.repository.TimetableTemplateDraftRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TimetableService {
    private final InstituteRepository instituteRepository;
    private final ClassTimetableRepository classTimetableRepository;
    private final TimetableTemplateDraftRepository timetableTemplateDraftRepository;
    private final ObjectMapper objectMapper;

    public TimetableService(
            InstituteRepository instituteRepository,
            ClassTimetableRepository classTimetableRepository,
            TimetableTemplateDraftRepository timetableTemplateDraftRepository,
            ObjectMapper objectMapper
    ) {
        this.instituteRepository = instituteRepository;
        this.classTimetableRepository = classTimetableRepository;
        this.timetableTemplateDraftRepository = timetableTemplateDraftRepository;
        this.objectMapper = objectMapper;
    }

    public List<ClassTimetableResponse> getClassTimetables(Long instituteId) {
        validateInstitute(instituteId);
        return classTimetableRepository.findAllByInstituteIdOrderByClassNameAsc(instituteId)
                .stream()
                .map(this::toClassTimetableResponse)
                .toList();
    }

    @Transactional
    public ClassTimetableResponse saveClassTimetable(Long instituteId, ClassTimetablePayload request) {
        Institute institute = validateInstitute(instituteId);
        ClassTimetable timetable = classTimetableRepository
                .findByInstituteIdAndClassNameIgnoreCase(instituteId, request.className().trim())
                .orElseGet(ClassTimetable::new);

        if (timetable.getId() == null) {
            timetable.setInstitute(institute);
        }

        applyClassTimetablePayload(timetable, request);
        return toClassTimetableResponse(classTimetableRepository.save(timetable));
    }

    @Transactional
    public void deleteClassTimetable(Long instituteId, Long timetableId) {
        ClassTimetable timetable = classTimetableRepository.findByInstituteIdAndId(instituteId, timetableId)
                .orElseThrow(() -> new ResourceNotFoundException("Class timetable not found with id: " + timetableId));
        classTimetableRepository.delete(timetable);
    }

    public List<TimetableTemplateDraftResponse> getTemplateDrafts(Long instituteId) {
        validateInstitute(instituteId);
        return timetableTemplateDraftRepository.findAllByInstituteIdOrderByClassNameAsc(instituteId)
                .stream()
                .map(this::toTemplateDraftResponse)
                .toList();
    }

    @Transactional
    public TimetableTemplateDraftResponse saveTemplateDraft(Long instituteId, TimetableTemplateDraftPayload request) {
        Institute institute = validateInstitute(instituteId);
        TimetableTemplateDraft draft = timetableTemplateDraftRepository
                .findByInstituteIdAndClassNameIgnoreCase(instituteId, request.className().trim())
                .orElseGet(TimetableTemplateDraft::new);

        if (draft.getId() == null) {
            draft.setInstitute(institute);
        }

        draft.setClassName(request.className().trim());
        draft.setDraftDataJson(writeJson(request.draftData()));
        return toTemplateDraftResponse(timetableTemplateDraftRepository.save(draft));
    }

    @Transactional
    public void deleteTemplateDraft(Long instituteId, Long draftId) {
        TimetableTemplateDraft draft = timetableTemplateDraftRepository.findByInstituteIdAndId(instituteId, draftId)
                .orElseThrow(() -> new ResourceNotFoundException("Timetable draft not found with id: " + draftId));
        timetableTemplateDraftRepository.delete(draft);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void applyClassTimetablePayload(ClassTimetable timetable, ClassTimetablePayload request) {
        timetable.setClassName(request.className().trim());
        timetable.setFileName(trim(request.fileName()));
        timetable.setFileData(trim(request.fileData()));
        timetable.setFileType(trim(request.fileType()));
        timetable.setUploadedAt(resolveDateTime(request.uploadedAt(), timetable.getUploadedAt()));
        timetable.setTemplateDataJson(writeJson(request.templateData()));
        timetable.setTemplateMetaJson(writeJson(request.templateMeta()));
    }

    private ClassTimetableResponse toClassTimetableResponse(ClassTimetable timetable) {
        return new ClassTimetableResponse(
                timetable.getId(),
                timetable.getClassName(),
                timetable.getFileName(),
                timetable.getFileData(),
                timetable.getFileType(),
                timetable.getUploadedAt(),
                readJsonObject(timetable.getTemplateDataJson()),
                readJsonObject(timetable.getTemplateMetaJson()),
                timetable.getCreatedAt(),
                timetable.getUpdatedAt()
        );
    }

    private TimetableTemplateDraftResponse toTemplateDraftResponse(TimetableTemplateDraft draft) {
        return new TimetableTemplateDraftResponse(
                draft.getId(),
                draft.getClassName(),
                readJsonObject(draft.getDraftDataJson()),
                draft.getCreatedAt(),
                draft.getUpdatedAt()
        );
    }

    private LocalDateTime resolveDateTime(String value, LocalDateTime fallback) {
        if (StringUtils.hasText(value)) {
            String trimmedValue = value.trim();
            try {
                return LocalDateTime.parse(trimmedValue);
            } catch (Exception ignored) {
                return OffsetDateTime.parse(trimmedValue).toLocalDateTime();
            }
        }
        return fallback == null ? LocalDateTime.now() : fallback;
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to save timetable JSON data.", exception);
        }
    }

    private Object readJsonObject(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            return objectMapper.readValue(value, new TypeReference<Object>() {
            });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to read timetable JSON data.", exception);
        }
    }
}
