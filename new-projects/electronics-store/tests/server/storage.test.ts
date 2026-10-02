import 'dotenv/config';
import {describe,expect,it} from 'vitest';
import {DeleteObjectCommand} from '@aws-sdk/client-s3';
import {upload,s3,publicUrl} from '../../src/server/storage';
describe('S3 image storage',()=>{
 it('uploads a validated PNG to isolated MinIO and serves identical bytes',async()=>{
  if(process.env.TEST_MODE!=='true'||!process.env.S3_ENDPOINT?.includes('59020'))throw new Error('Isolated MinIO required');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZAAAAABJRU5ErkJggg==','base64');
  const result=await upload(new File([bytes],'integration.png',{type:'image/png'}));
  try{const response=await fetch(result.url);expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('image/png');expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);}
  finally{await s3.send(new DeleteObjectCommand({Bucket:process.env.S3_BUCKET,Key:result.url.slice(publicUrl('').length)}));}
 });
 it('rejects disguised scripts and oversized images',async()=>{
  await expect(upload(new File(['<script>alert(1)</script>'],'fake.png',{type:'image/png'}))).rejects.toThrow('PNG');
  await expect(upload(new File([new Uint8Array(5*1024*1024+1)],'huge.png',{type:'image/png'}))).rejects.toThrow('5 МБ');
 });
});
