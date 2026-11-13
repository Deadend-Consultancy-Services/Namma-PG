import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useState } from 'react';
import api, { errMsg } from './api.js';

export const useGet = (key, url, params, opts = {}) =>
  useQuery({ queryKey: [key, params ?? {}], queryFn: () => api.get(url, { params }).then((r) => r.data), ...opts });

/** Mutation helper. `url` may be a string or (vars) => string. Invalidates all queries on success so every screen stays in sync. */
export function useMut(method, url, { success, onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => api({ method, url: typeof url === 'function' ? url(vars) : url, data: method === 'delete' ? undefined : vars?.__body ?? vars }).then((r) => r.data),
    onSuccess: (data, vars) => { if (success) toast.success(typeof success === 'function' ? success(data, vars) : success); qc.invalidateQueries(); onSuccess?.(data, vars); },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useForm(initial) {
  const [v, setV] = useState(initial);
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const bind = (k) => ({ value: v[k] ?? '', onChange: (e) => set(k, e.target.value) });
  return { v, set, bind, reset: (x = initial) => setV(x), setAll: setV };
}
