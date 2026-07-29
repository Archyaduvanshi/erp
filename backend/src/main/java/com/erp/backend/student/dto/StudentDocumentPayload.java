package com.erp.backend.student.dto;

public record StudentDocumentPayload(
        Long id,
        String documentType,
        String fileUploadPath,
        String fileName,
        String fileType,
        String fileData,
        Long fileSize
) {
}
