export function getRequiredProdEnvVariable(variableName: string) {
  return process.env.ENV === `prod`
    ? getRequiredEnvVariable(variableName)
    : process.env[variableName];
}

export function getRequiredEnvVariable(variableName: string) {
  const envVariable = process.env[variableName];

  if (
    process.env.NODE_ENV !== 'test' &&
    (envVariable === undefined || envVariable === '')
  ) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }

  return envVariable;
}