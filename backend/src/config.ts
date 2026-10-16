import { resolve } from 'node:path';
import { config as dotenv } from 'dotenv';
dotenv({path:resolve(process.cwd(),'.env.local')});
dotenv({path:resolve(process.cwd(),'.env')});
export type Config = {production:boolean;host:string;port:number;origin:string;learnerOrigin?:string;mobileOrigin?:string;allowedOrigins?:string[];dataDir:string;databaseUrl?:string;adminEmail:string;adminPassword?:string;sessionHours:number;openmaicUrl?:string;bridgeSecret?:string;seedDemo:boolean;aiEncryptionKey?:string};
export function readConfig():Config {
  const production=process.env.NODE_ENV==='production';
  const config:Config={production,host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||4190),origin:process.env.ADMIN_ORIGIN||'http://127.0.0.1:4180',dataDir:resolve(process.env.DATA_DIR||'./data'),databaseUrl:process.env.DATABASE_URL||undefined,adminEmail:process.env.BOOTSTRAP_ADMIN_EMAIL||'admin@ola.local',adminPassword:process.env.BOOTSTRAP_ADMIN_PASSWORD||undefined,sessionHours:Number(process.env.SESSION_HOURS||12),openmaicUrl:process.env.OPENMAIC_URL||undefined,bridgeSecret:process.env.OLA_BRIDGE_SECRET||undefined,seedDemo:!production};
  if (!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('Invalid PORT');
  if (!Number.isFinite(config.sessionHours)||config.sessionHours<1||config.sessionHours>168)throw new Error('SESSION_HOURS must be 1..168');
  if(production&&!config.databaseUrl)throw new Error('Production requires DATABASE_URL');
  if(production&&!config.origin.startsWith('https://'))throw new Error('Production requires HTTPS ADMIN_ORIGIN');
  config.learnerOrigin=process.env.LEARNER_ORIGIN||(!production?'http://127.0.0.1:4181':undefined);
  config.mobileOrigin=process.env.MOBILE_ORIGIN||(!production?'http://127.0.0.1:4173':undefined);
  config.allowedOrigins=[...new Set((process.env.EXTRA_ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean))];
  for(const origin of config.allowedOrigins){
    const parsed=new URL(origin);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.origin!==origin)throw new Error('EXTRA_ALLOWED_ORIGINS requires exact HTTP(S) origins');
    if(production&&parsed.protocol!=='https:')throw new Error('Production requires HTTPS EXTRA_ALLOWED_ORIGINS');
  }
  if(production&&config.mobileOrigin&&!config.mobileOrigin.startsWith('https://'))throw new Error('Production requires HTTPS MOBILE_ORIGIN');
  config.aiEncryptionKey=process.env.AI_CONFIG_ENCRYPTION_KEY||undefined;
  if(config.aiEncryptionKey&&!/^[a-fA-F0-9]{64}$/.test(config.aiEncryptionKey))throw new Error('AI_CONFIG_ENCRYPTION_KEY must be 64 hex characters');
  if(production&&config.learnerOrigin&&!config.learnerOrigin.startsWith('https://'))throw new Error('Production requires HTTPS LEARNER_ORIGIN');
  if(config.adminPassword&&config.adminPassword.length<12)throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters');
  if(config.openmaicUrl&&(!config.bridgeSecret||config.bridgeSecret.length<32))throw new Error('OpenMAIC requires a shared bridge secret of at least 32 characters');
  return config;
}
