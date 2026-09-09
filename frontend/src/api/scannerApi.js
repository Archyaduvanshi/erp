import { scannerApi } from '../utils/api';

export const resolveQrIdentity = (qrData, feature) => scannerApi.resolve({ qrData, feature });

export const regenerateStudentQr = (studentId) => scannerApi.regenerateStudent(studentId);

export const regenerateTeacherQr = (teacherId) => scannerApi.regenerateTeacher(teacherId);
