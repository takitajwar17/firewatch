type LogField = boolean | number | string | undefined;

const safeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const compactFields = (fields: Record<string, LogField | unknown>) =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );

export const logFirewatchError = (
  code: string,
  fields: Record<string, LogField | unknown> = {}
) => {
  const { error, ...rest } = fields;
  console.error(`[firewatch] ${code}`, {
    ...compactFields(rest),
    ...(error ? { error: safeErrorMessage(error) } : {}),
  });
};

export const logFirewatchWarn = (
  code: string,
  fields: Record<string, LogField | unknown> = {}
) => {
  const { error, ...rest } = fields;
  console.warn(`[firewatch] ${code}`, {
    ...compactFields(rest),
    ...(error ? { error: safeErrorMessage(error) } : {}),
  });
};
