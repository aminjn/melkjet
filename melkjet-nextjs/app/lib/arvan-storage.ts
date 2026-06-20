import { createHash, createHmac } from 'crypto'
import { proxiedRequest } from './proxy-fetch'

// آپلودِ شیء روی پاس‌انبان آروان (S3-compatible) با امضای AWS Signature V4 — بدون
// هیچ کتابخانهٔ بیرونی. آروان داخل ایران است، پس مستقیم (بدون پروکسی) آپلود می‌کنیم؛
// و چون لینکِ نهایی هم از داخل ایران بدون فیلتر باز است، سرورِ گپ می‌تواند بخواندش.

export interface ArvanCfg {
  endpoint: string   // s3.ir-thr-at1.arvanstorage.ir
  bucket: string
  accessKey: string
  secretKey: string
  region?: string
}

const SERVICE = 's3'
const hmac = (key: Buffer | string, data: string): Buffer => createHmac('sha256', key).update(data, 'utf8').digest()
const sha256hex = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex')

export async function arvanUpload(cfg: ArvanCfg, objectKey: string, buf: Buffer, contentType: string): Promise<string> {
  const endpoint = cfg.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const region = cfg.region || endpoint.match(/s3\.([^.]+)\./)?.[1] || 'ir-thr-at1'
  const host = `${cfg.bucket}.${endpoint}`            // virtual-hosted–style
  const path = '/' + objectKey.replace(/^\//, '')
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '') // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256hex(buf)
  const acl = 'public-read'

  const signed: Record<string, string> = {
    host,
    'x-amz-acl': acl,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  const signedHeaders = Object.keys(signed).sort().join(';')
  const canonicalHeaders = Object.keys(signed).sort().map(k => `${k}:${signed[k]}\n`).join('')
  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const scope = `${dateStamp}/${region}/${SERVICE}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n')
  const kDate = hmac('AWS4' + cfg.secretKey, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await proxiedRequest(`https://${host}${path}`, {
    method: 'PUT',
    headers: {
      'x-amz-acl': acl,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
      'Content-Type': contentType,
    },
    body: buf,
    timeout: 25000,
  })
  if (res.status >= 200 && res.status < 300) return `https://${host}${path}`
  throw new Error(`آپلود آروان ناموفق (HTTP ${res.status}): ${(res.body || '').slice(0, 200)}`)
}
