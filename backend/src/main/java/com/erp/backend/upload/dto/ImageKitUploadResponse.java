package com.erp.backend.upload.dto;

public record ImageKitUploadResponse(
        String url,
        String fileId,
        String name,
        String filePath,
        String thumbnailUrl,
        String fileType,
        Long size
) {
}
