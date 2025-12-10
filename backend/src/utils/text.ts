/**
 * Extrae nombres de usuario de un texto usando el patrón @username.
 * Devuelve un array de usernames únicos sin el símbolo @.
 */
export function extractMentions(content: string): string[] {
    const matches = content.match(/@(\w+)/g) || [];
    const usernames = matches.map(match => match.substring(1));
    return [...new Set(usernames)];
}