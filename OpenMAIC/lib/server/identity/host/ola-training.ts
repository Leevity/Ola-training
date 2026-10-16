import { createHmac, timingSafeEqual } from 'node:crypto';
import type { OwnerAuthMethod } from '@/lib/server/identity';

/** Private server-to-server identity. Never expose bridge credentials to browsers. */
export function olaTrainingAuthentication(secret: string): OwnerAuthMethod {
  if(secret.length<32)throw new Error('OLA_BRIDGE_SECRET must be at least 32 characters');
  const consumed=new Map<string,number>();
  const recognizes=(ownerId:string)=>/^ola:tenant:[a-zA-Z0-9_-]{1,128}$/.test(ownerId);
  return {
    name:'ola-training',
    async authenticate(req) {
      const raw=req.headers.get('x-ola-bridge');
      if(!raw)return {status:'not-applicable'};
      try {
        if(raw.length>2048)return {status:'invalid'};
        const [encoded,signature,...rest]=raw.split('.');if(rest.length||!encoded||!signature)return {status:'invalid'};
        const expected=createHmac('sha256',secret).update(encoded).digest();const actual=Buffer.from(signature,'base64url');
        if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return {status:'invalid'};
        const value=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));const now=Math.floor(Date.now()/1000);
        const url=new URL(req.url||'http://invalid');
        if(value.v!==1||!recognizes(value.ownerId)||value.method!==req.method||value.path!==url.pathname+url.search||!Number.isInteger(value.exp)||value.exp<now||value.exp>now+60||typeof value.nonce!=='string'||!/^[-a-zA-Z0-9]{1,128}$/.test(value.nonce))return {status:'invalid'};
        for(const [nonce,expires] of consumed)if(expires<now)consumed.delete(nonce);
        if(consumed.has(value.nonce)||consumed.size>=10000)return {status:'invalid'};
        consumed.set(value.nonce,value.exp);
        return {status:'authenticated',principal:{ownerId:value.ownerId,kind:'service',roles:new Set<string>(),assurance:'verified',channel:'ola-training'}};
      } catch{return {status:'invalid'};}
    },
    describeStoredOwner(ownerId){return recognizes(ownerId)?{kind:'service',roles:new Set<string>()}:undefined;},
  };
}
