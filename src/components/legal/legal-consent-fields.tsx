"use client";

import { useState } from "react";
import Link from "next/link";
import { CountrySelect } from "@/components/legal/country-select";
import { Label } from "@/components/ui/label";

export type LegalConsentValues = {
  residenceCountry: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  attestAge18: boolean;
};

export function LegalConsentFields({
  values,
  onChange,
}: {
  values: LegalConsentValues;
  onChange: (next: LegalConsentValues) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="residenceCountry">País donde vivís</Label>
        <CountrySelect
          id="residenceCountry"
          value={values.residenceCountry}
          onChange={(residenceCountry) => onChange({ ...values, residenceCountry })}
        />
        <p className="text-xs text-muted">
          Lo usamos para no abrirte un PDF fuera del territorio autorizado. No es tu
          nacionalidad.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={values.attestAge18}
          onChange={(e) => onChange({ ...values, attestAge18: e.target.checked })}
          required
        />
        <span>Declaro que soy mayor de 18 años.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={values.acceptTerms}
          onChange={(e) => onChange({ ...values, acceptTerms: e.target.checked })}
          required
        />
        <span>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className="font-semibold text-accent hover:underline">
            términos
          </Link>{" "}
          (borrador, pendiente de abogado).
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={values.acceptPrivacy}
          onChange={(e) => onChange({ ...values, acceptPrivacy: e.target.checked })}
          required
        />
        <span>
          Acepto la{" "}
          <Link href="/privacidad" target="_blank" className="font-semibold text-accent hover:underline">
            privacidad
          </Link>{" "}
          (borrador, pendiente de abogado).
        </span>
      </label>
    </div>
  );
}

export function emptyLegalConsent(): LegalConsentValues {
  return {
    residenceCountry: "",
    acceptTerms: false,
    acceptPrivacy: false,
    attestAge18: false,
  };
}

export function useLegalConsent(initial?: Partial<LegalConsentValues>) {
  return useState<LegalConsentValues>({ ...emptyLegalConsent(), ...initial });
}
