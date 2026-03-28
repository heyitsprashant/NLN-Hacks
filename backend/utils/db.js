function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function normalizeDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
    resolved_at: toIso(data.resolved_at),
  };
}

module.exports = {
  toIso,
  normalizeDoc,
};
