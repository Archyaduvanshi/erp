package com.erp.backend.teacher.dto;

public record TeacherDocumentPayload(
        Long id,
        String documentType,
        String fileUploadPath,
        String fileName,
        String fileType,
        String fileData,
        Long fileSize
) {
}
