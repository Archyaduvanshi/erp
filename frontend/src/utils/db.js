import { authApi } from './api';

const memoryStore = new Map();

export const db = {
  // Get currently logged-in college from session
  getTenantId: () => {
    const session = authApi.getCachedSession();
    return session?.username || session?.id || null;
  },

  // Save data isolated by College (e.g., "mit_students")
  save: (module, data) => {
    const tenantId = db.getTenantId();
    if (!tenantId) return null;

    const key = `${tenantId}_${module}`;
    const existing = memoryStore.get(key) || [];
    const updated = sanitizeForStorage(module, [
      ...existing,
      { ...data, id: Date.now(), createdAt: new Date().toISOString() },
    ]);
    
    memoryStore.set(key, updated);
    return updated;
  },

  update: (module, id, updater) => {
    const tenantId = db.getTenantId();
    if (!tenantId) return null;

    const key = `${tenantId}_${module}`;
    const existing = memoryStore.get(key) || [];
    const updated = sanitizeForStorage(module, existing.map((entry) => {
      if (String(entry.id) !== String(id)) return entry;
      const nextValue = typeof updater === 'function' ? updater(entry) : { ...entry, ...updater };
      return {
        ...entry,
        ...nextValue,
        updatedAt: new Date().toISOString(),
      };
    }));

    memoryStore.set(key, updated);
    return updated;
  },

  // Get only this college's data
  getAll: (module) => {
    const tenantId = db.getTenantId();
    if (!tenantId) return [];
    return memoryStore.get(`${tenantId}_${module}`) || [];
  },

  replaceAll: (module, data) => {
    const tenantId = db.getTenantId();
    if (!tenantId) return [];
    const sanitizedData = sanitizeForStorage(module, data || []);
    memoryStore.set(`${tenantId}_${module}`, sanitizedData);
    return sanitizedData;
  },

  // Logout / Clear Session
  logout: () => {
    authApi.logout().finally(() => {
      window.location.href = '/login';
    });
  }
};

function sanitizeForStorage(module, data) {
  if (!Array.isArray(data)) {
    return data;
  }

  if (module !== 'teachers' && module !== 'students') {
    return data;
  }

  return data.map((entry) => sanitizeProfileRecord(entry));
}

function sanitizeProfileRecord(entry) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  return {
    ...entry,
    photoUrl: isInlineDataUrl(entry.photoUrl) ? '' : entry.photoUrl,
    documents: Array.isArray(entry.documents)
      ? entry.documents.map((document) => sanitizeDocumentRecord(document))
      : entry.documents,
  };
}

function isInlineDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function sanitizeDocumentRecord(document) {
  if (!document || typeof document !== 'object') {
    return document;
  }

  return {
    ...document,
    fileData: isInlineDataUrl(document.fileData) ? '' : document.fileData,
  };
}
