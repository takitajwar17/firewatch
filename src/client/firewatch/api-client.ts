import { readErrorMessage } from './format';

type JsonRequestOptions = {
  body?: unknown;
  method?: 'GET' | 'POST';
};

export const requestJson = async <Payload>(
  endpoint: string,
  { body, method = 'GET' }: JsonRequestOptions = {}
) => {
  const requestInit: RequestInit = { method };
  if (body !== undefined) {
    requestInit.headers = { 'content-type': 'application/json' };
    requestInit.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, requestInit);
  if (!res.ok) throw new Error(await readErrorMessage(res));

  const payload: Payload = await res.json();
  return payload;
};
