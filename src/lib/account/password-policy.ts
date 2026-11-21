export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";
export const PASSWORD_REQUIREMENTS = "Use 12–128 characters with a lowercase letter, an uppercase letter, a number and a symbol.";

export function hasStrongPasswordShape(password: string) {
  return password.length >= PASSWORD_MIN_LENGTH
    && password.length <= PASSWORD_MAX_LENGTH
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && [...password].some(character => PASSWORD_SYMBOLS.includes(character));
}
