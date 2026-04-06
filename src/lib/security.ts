const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;

export function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(username: string) {
  const normalized = normalizeIdentifier(username);

  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      message:
        'Username must be 3-32 characters and only contain letters, numbers, or underscores.',
      normalized,
    };
  }

  return { valid: true, normalized };
}

export function validatePassword(password: string) {
  if (password.length < 12) {
    return {
      valid: false,
      message: 'Password must be at least 12 characters long.',
    };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return {
      valid: false,
      message:
        'Password must include at least 1 uppercase, 1 lowercase, 1 number, and 1 special character.',
    };
  }

  return { valid: true };
}
