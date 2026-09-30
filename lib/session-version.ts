/**
 * Revocación de sesión: cada sesión (JWT) lleva estampada la `sessionVersion` del usuario en el
 * momento de iniciar sesión. Si en la base de datos esa versión ha subido desde entonces (alguien
 * la incrementó al revocarle un rol, por ejemplo), la sesión ya emitida deja de ser válida al
 * momento — sin esto, el JWT seguía funcionando hasta sus 7 días de caducidad pasase lo que pasase.
 *
 * Fail-open a propósito: un token sin `sessionVersion` (emitido antes de este cambio) o un fallo al
 * leer la base de datos nunca invalidan la sesión — solo una versión en BD estrictamente mayor lo hace.
 */
export function isSessionVersionValid(tokenVersion: number | undefined, currentVersion: number | null | undefined): boolean {
  if (tokenVersion == null) return true
  if (currentVersion == null) return true
  return currentVersion <= tokenVersion
}
