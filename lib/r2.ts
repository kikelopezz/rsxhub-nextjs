import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucketName = process.env.R2_BUCKET_NAME
const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, '')

export const hasR2 = Boolean(accountId && accessKeyId && secretAccessKey && bucketName && publicUrl)

let client: S3Client | null = null

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    })
  }
  return client
}

export function getR2PublicUrl(key: string): string {
  return `${publicUrl}/${key}`
}

export function getR2KeyFromUrl(url: string): string | null {
  if (!publicUrl || !url.startsWith(`${publicUrl}/`)) return null
  // Strip a cache-busting query string (e.g. logo/banner uploads append `?v=...` so
  // re-uploading the same deterministic filename isn't served stale from cache) before
  // slicing off the key — otherwise it'd be treated as part of the R2 object key.
  const withoutQuery = url.split('?')[0].split('#')[0]
  return withoutQuery.slice(publicUrl.length + 1)
}

export async function uploadBufferToR2(key: string, buffer: Buffer, contentType: string): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
  return getR2PublicUrl(key)
}

export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}

export async function listR2Objects(prefix: string): Promise<string[]> {
  const urls: string[] = []
  let continuationToken: string | undefined
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of res.Contents || []) {
      if (obj.Key) urls.push(getR2PublicUrl(obj.Key))
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return urls
}

export async function getR2StorageStats(): Promise<{ usedBytes: number; objectCount: number }> {
  let usedBytes = 0
  let objectCount = 0
  let continuationToken: string | undefined
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of res.Contents || []) {
      usedBytes += obj.Size || 0
      objectCount += 1
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return { usedBytes, objectCount }
}

export async function createPresignedUploadUrl(key: string, contentType: string, expiresInSeconds = 600): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType })
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds })
}
