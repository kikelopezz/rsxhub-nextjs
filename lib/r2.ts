import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NodeHttpHandler } from '@smithy/node-http-handler'

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
      // Sin esto, el SDK no tiene ningún límite de tiempo propio: si R2 tarda en aceptar la
      // conexión o se queda a medias respondiendo, la petición del servidor se queda colgada
      // indefinidamente — y con ella, el botón de "Subiendo..." en el navegador, que solo deja
      // de girar cuando esta promesa se resuelve o falla. Con el timeout, falla en vez de colgarse,
      // y el código que llama (uploadBufferToR2 en app/api/uploads/route.ts) ya cae al disco/base64
      // como alternativa cuando R2 lanza un error.
      requestHandler: new NodeHttpHandler({ connectionTimeout: 5_000, requestTimeout: 20_000 }),
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

/**
 * First `byteLength` bytes of an object — enough to check its magic bytes without downloading
 * the whole thing (used to verify a file uploaded straight to R2 via a presigned URL, since the
 * server never otherwise sees those bytes). Returns null if the object doesn't exist.
 */
export async function getR2ObjectPrefix(key: string, byteLength: number): Promise<Buffer | null> {
  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: bucketName, Key: key, Range: `bytes=0-${byteLength - 1}` })
    )
    if (!res.Body) return null
    const chunks: Buffer[] = []
    for await (const chunk of res.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  } catch (err: any) {
    if (err?.name === 'NoSuchKey') return null
    throw err
  }
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
