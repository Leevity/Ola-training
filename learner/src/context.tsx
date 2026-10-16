import { createContext, useContext, useEffect, useState } from 'react';
import type { Overview, Tenant, User } from './types';
export type Portal = {
  data: Overview;
  user: User;
  tenants: Tenant[];
  refresh: () => Promise<Overview>;
  go: (path: string) => void;
  notify: (message: string, error?: boolean) => void;
  run: <T>(action: () => Promise<T>, success?: string) => Promise<T | undefined>;
};
export const PortalContext = createContext<Portal>(null!);
export const usePortal = () => useContext(PortalContext);
export function useRemote<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [value, setValue] = useState<T | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setValue(null);
    setError('');
    load()
      .then((v) => {
        if (live) setValue(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [...deps, revision]);
  return { value, error, retry: () => setRevision((r) => r + 1), setValue };
}
