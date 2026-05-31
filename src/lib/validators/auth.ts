import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(6, "Lösenordet måste vara minst 6 tecken"),
});

export const registerSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(6, "Lösenordet måste vara minst 6 tecken"),
  displayName: z.string().min(1, "Ange ett namn").max(50),
});

export const resetSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
});

export const requestAccessSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  displayName: z.string().min(1, "Ange ett namn").max(50),
  message: z.string().max(500).optional(),
});
