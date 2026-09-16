export function publicAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/URL_INVALID|TRILLIONTAPE_DATABASE|not the book/i.test(message)) {
    return "The book is not connected. On Fly → trilliontape → Secrets, TRILLIONTAPE_DATABASE_URL must not be trilliontape.fly.dev. Delete that secret to play on this machine’s file, or set https://trilliontape-data.fly.dev after the data host is up.";
  }
  return message;
}
