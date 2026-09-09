import { scannerApi } from '../utils/api';

export const resolveQrIdentity = (qrData, feature, context = {}) => scannerApi.resolve({ qrData, feature, ...context });

export const regenerateStudentQr = (studentId) => scannerApi.regenerateStudent(studentId);

export const regenerateTeacherQr = (teacherId) => scannerApi.regenerateTeacher(teacherId);
