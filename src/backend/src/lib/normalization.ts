const VIETNAM_COUNTRY_CODE = "84";

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Email must be a valid address.");
  }

  return normalized;
}

export function normalizeVietnamPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const localNumber = digits.startsWith("0") ? digits.slice(1) : digits;
  const withoutCountryCode = localNumber.startsWith(VIETNAM_COUNTRY_CODE)
    ? localNumber.slice(VIETNAM_COUNTRY_CODE.length)
    : localNumber;

  if (!/^\d{9,10}$/.test(withoutCountryCode)) {
    throw new Error("Phone must be a valid Vietnamese phone number.");
  }

  return `+${VIETNAM_COUNTRY_CODE}${withoutCountryCode}`;
}
