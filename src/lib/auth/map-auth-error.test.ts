import { describe, expect, it } from "vitest";
import { mapAuthErrorMessage } from "./map-auth-error";

describe("mapAuthErrorMessage", () => {
  it("maps common Supabase English errors", () => {
    expect(mapAuthErrorMessage("Invalid login credentials")).toBe(
      "Email o contraseña incorrectos."
    );
    expect(mapAuthErrorMessage("Email not confirmed")).toMatch(/confirm/i);
    expect(mapAuthErrorMessage("User already registered")).toMatch(/registrado/i);
  });

  it("falls back for unknown English messages", () => {
    expect(mapAuthErrorMessage("Something went wrong")).toMatch(/autenticación/i);
  });

  it("keeps Spanish messages", () => {
    expect(mapAuthErrorMessage("Contraseña incorrecta")).toBe(
      "Contraseña incorrecta"
    );
  });

  it("maps user not found like invalid credentials (no email enumeration)", () => {
    expect(mapAuthErrorMessage("User not found")).toBe(
      "Email o contraseña incorrectos."
    );
  });

  it("maps SMTP / send failures", () => {
    expect(mapAuthErrorMessage("Error sending confirmation email")).toMatch(
      /SMTP|correo/i
    );
  });
});
