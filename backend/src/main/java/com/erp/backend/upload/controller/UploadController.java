package com.erp.backend.upload.controller;

import java.time.Duration;

import com.erp.backend.auth.ClientIpResolver;
import com.erp.backend.auth.RateLimiterService;
import com.erp.backend.upload.dto.ImageKitUploadResponse;
import com.erp.backend.upload.service.ImageKitUploadService;
import jakarta.servlet.http.HttpServletRequest;
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
    private final RateLimiterService rateLimiterService;
    private final ClientIpResolver clientIpResolver;

    public UploadController(ImageKitUploadService imageKitUploadService, RateLimiterService rateLimiterService, ClientIpResolver clientIpResolver) {
        this.imageKitUploadService = imageKitUploadService;
        this.rateLimiterService = rateLimiterService;
        this.clientIpResolver = clientIpResolver;
    }

    @PostMapping(value = "/imagekit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ImageKitUploadResponse uploadToImageKit(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false) String folder
    ) {
        return imageKitUploadService.upload(file, folder);
    }

    @PostMapping(value = "/registration-logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ImageKitUploadResponse uploadRegistrationLogo(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        rateLimiterService.check("registration-logo-upload", clientIpResolver.resolve(request), 12, Duration.ofMinutes(10));
        return imageKitUploadService.uploadRegistrationLogo(file);
    }
}
