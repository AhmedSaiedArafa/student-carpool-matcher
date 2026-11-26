const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const AppError = require('../../utils/AppError');

const s3 = new S3Client({ forcePathStyle: true });
const BUCKET = process.env.HISTORY_BUCKET || 'carpool-history-exports';

async function saveExport(userId, csv) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `exports/user-${userId}/${ts}.csv`;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: csv,
      ContentType: 'text/csv',
    }));
    return { bucket: BUCKET, key };
  } catch (err) {
    throw new AppError(502, 'EXPORT_STORAGE_ERROR', 'Could not save the export to cloud storage');
  }
}

async function listExports(userId) {
  const prefix = `exports/user-${userId}/`;
  try {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    }));
    const items = (res.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      saved_at: obj.LastModified,
    }));
    items.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
    return items;
  } catch (err) {
    throw new AppError(502, 'EXPORT_STORAGE_ERROR', 'Could not save the export to cloud storage');
  }
}

module.exports = { saveExport, listExports };
