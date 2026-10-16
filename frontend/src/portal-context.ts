import {createContext,useContext} from 'react';
import type {Overview,User,Tenant} from '@ola/learner-client/types';
export type Session={user:User;tenants:Tenant[]};
export type Portal={session:Session;data:Overview;refresh:()=>Promise<Overview>;changeTenant:(id:string)=>Promise<void>;logout:()=>Promise<void>;notify:(message:string)=>void};
export const Context=createContext<Portal|null>(null);
export function usePortal(){const value=useContext(Context);if(!value)throw new Error('Missing portal');return value;}
