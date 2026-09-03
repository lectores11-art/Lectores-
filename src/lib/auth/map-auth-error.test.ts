import { describe, expect, it } from "vitest";
import { mapAuthError, mapAuthErrorMessage } from "./map-auth-error";

describe("mapAuthErrorMessage", () => {
  it("maps common Supabase English errors", () => {
    expect(mapAuthErrorMessage("Invalid login credentials")).toBe(
      "Email o contraseña incorrectos."
    );
    expect(mapAuthErrorMessage("Email not confirmed")).toMatch(/confirm/i);
    expect(mapAuthErrorMessage("User already registered")).toMatch(/registrado/i);
    expect(mapAuthErrorMessage("Database error saving new user")).toMatch(
      /iniciá sesión/i
    );
  });

  it("maps Auth error codes", () => {
    expect(mapAuthError({ code: "leaked_password", message: "x" })).toMatch(
      /común/i
    );
    expect(mapAuthError({ code: "weird_code", message: "" })).toMatch(/weird_code/);
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
