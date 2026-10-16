export function readQuestion(command: string): string {
  const question = process.argv[2]?.trim();
  if (!question) {
    console.error(`Usage: ${command} "<question>"`);
    process.exit(1);
  }
  return question;
}
