"use client";

import { COUNTRY_OPTIONS } from "@/lib/legal/countries";

export function CountrySelect({
  id,
  name = "residenceCountry",
  value,
  onChange,
  required = true,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      name={name}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
    >
      <option value="">Elegí tu país de residencia</option>
      {COUNTRY_OPTIONS.map((country) => (
        <option key={country.code} value={country.code}>
          {country.name}
        </option>
      ))}
    </select>
  );
}
