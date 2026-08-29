package com.erp.backend.upload.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import com.erp.backend.upload.dto.ImageKitUploadResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageKitUploadService {
    private static final String IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
    private static final long MAX_REGISTRATION_LOGO_BYTES = 5L * 1024L * 1024L;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${imagekit.private-key:}")
    private String privateKey;

    @Value("${imagekit.default-folder:/erp}")
    private String defaultFolder;

    public ImageKitUploadService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
    }

    public ImageKitUploadResponse upload(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Upload file is required.");
        }
        if (!isConfiguredSecret(privateKey)) {
            throw new IllegalStateException("ImageKit private key is not configured. Set IMAGEKIT_PRIVATE_KEY in backend/.env.");
        }

        String boundary = "----erp-imagekit-" + UUID.randomUUID();
        String targetFolder = normalizeFolder(folder);

        try {
            byte[] requestBody = buildMultipartBody(file, targetFolder, boundary);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(IMAGEKIT_UPLOAD_URL))
                    .header("Authorization", "Basic " + Base64.getEncoder().encodeToString((privateKey + ":").getBytes(StandardCharsets.UTF_8)))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("ImageKit upload failed: " + response.body());
            }

            JsonNode body = objectMapper.readTree(response.body());
            String uploadedUrl = body.path("url").asText("");
            if (!StringUtils.hasText(uploadedUrl)) {
                throw new IllegalStateException("ImageKit upload completed without a file URL.");
            }
            return new ImageKitUploadResponse(
                    uploadedUrl,
                    body.path("fileId").asText(""),
                    body.path("name").asText(file.getOriginalFilename()),
                    body.path("filePath").asText(""),
                    body.path("thumbnailUrl").asText(""),
                    body.path("fileType").asText(file.getContentType()),
                    body.path("size").isNumber() ? body.path("size").asLong() : file.getSize()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to upload file to ImageKit.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("ImageKit upload was interrupted.", exception);
        }
    }

    public ImageKitUploadResponse uploadRegistrationLogo(MultipartFile file) {
        validateRegistrationLogo(file);
        return upload(file, "/erp/registration/logos");
    }

    private byte[] buildMultipartBody(MultipartFile file, String folder, String boundary) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        writeTextPart(output, boundary, "fileName", sanitizeFileName(file.getOriginalFilename()));
        writeTextPart(output, boundary, "folder", folder);
        writeTextPart(output, boundary, "useUniqueFileName", "true");
        writeFilePart(output, boundary, file);
        output.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        return output.toByteArray();
    }

    private void writeTextPart(ByteArrayOutputStream output, String boundary, String name, String value) throws IOException {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void writeFilePart(ByteArrayOutputStream output, String boundary, MultipartFile file) throws IOException {
        String contentType = StringUtils.hasText(file.getContentType()) ? file.getContentType() : "application/octet-stream";
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + sanitizeFileName(file.getOriginalFilename()) + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(file.getBytes());
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String normalizeFolder(String folder) {
        String selectedFolder = StringUtils.hasText(folder) ? folder.trim() : defaultFolder;
        if (!selectedFolder.startsWith("/")) {
            selectedFolder = "/" + selectedFolder;
        }
        return selectedFolder.replaceAll("/{2,}", "/");
    }

    private String sanitizeFileName(String fileName) {
        String safeName = StringUtils.hasText(fileName) ? fileName.trim() : "upload";
        return safeName.replaceAll("[\\\\/\\r\\n\"]", "-");
    }

    private void validateRegistrationLogo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Institution logo is required.");
        }
        if (file.getSize() > MAX_REGISTRATION_LOGO_BYTES) {
            throw new IllegalArgumentException("Institution logo must be 5 MB or smaller.");
        }
        String contentType = StringUtils.hasText(file.getContentType()) ? file.getContentType().toLowerCase() : "";
        if (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/webp")) {
            throw new IllegalArgumentException("Institution logo must be JPEG, PNG, or WEBP.");
        }
        try {
            byte[] bytes = file.getBytes();
            if (!hasAllowedImageSignature(bytes, contentType)) {
                throw new IllegalArgumentException("Institution logo file signature does not match JPEG, PNG, or WEBP.");
            }
        } catch (IOException exception) {
            throw new IllegalArgumentException("Institution logo could not be read.");
        }
    }

    private boolean hasAllowedImageSignature(byte[] bytes, String contentType) {
        if ("image/jpeg".equals(contentType)) {
            return bytes.length >= 3
                    && (bytes[0] & 0xFF) == 0xFF
                    && (bytes[1] & 0xFF) == 0xD8
                    && (bytes[2] & 0xFF) == 0xFF;
        }
        if ("image/png".equals(contentType)) {
            byte[] png = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
            if (bytes.length < png.length) return false;
            for (int index = 0; index < png.length; index++) {
                if (bytes[index] != png[index]) return false;
            }
            return true;
        }
        if ("image/webp".equals(contentType)) {
            return bytes.length >= 12
                    && bytes[0] == 'R'
                    && bytes[1] == 'I'
                    && bytes[2] == 'F'
                    && bytes[3] == 'F'
                    && bytes[8] == 'W'
                    && bytes[9] == 'E'
                    && bytes[10] == 'B'
                    && bytes[11] == 'P';
        }
        return false;
    }

    private boolean isConfiguredSecret(String value) {
        return StringUtils.hasText(value) && !value.trim().startsWith("replace_with_");
    }
}
