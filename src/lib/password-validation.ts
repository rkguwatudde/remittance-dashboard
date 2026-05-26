export function passwordMeetsRequirements(password: string): {
  pwdLenOk: boolean;
  pwdMatchOk: boolean;
  complexityOk: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNum: boolean;
  hasSym: boolean;
} {
  const pwdLenOk = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /\d/.test(password);
  const hasSym = /[^A-Za-z0-9]/.test(password);
  const complexityOk = hasUpper && hasLower && hasNum && hasSym;

  return {
    pwdLenOk,
    pwdMatchOk: password.length > 0,
    complexityOk,
    hasUpper,
    hasLower,
    hasNum,
    hasSym,
  };
}

export function passwordsMatch(newPassword: string, confirm: string): boolean {
  return newPassword.length > 0 && newPassword === confirm;
}
