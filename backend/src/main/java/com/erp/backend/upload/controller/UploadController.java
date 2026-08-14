package com.erp.backend.upload.controller;

import com.erp.backend.upload.dto.ImageKitUploadResponse;
import com.erp.backend.upload.service.ImageKitUploadService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {
    private final ImageKitUploadService imageKitUploadService;

    public UploadController(ImageKitUploadService imageKitUploadService) {
        this.imageKitUploadService = imageKitUploadService;
    }

    @PostMapping(value = "/imagekit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ImageKitUploadResponse uploadToImageKit(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false) String folder
    ) {
        return imageKitUploadService.upload(file, folder);
    }
}
