/**
 * Variables de entorno que la aplicación necesita, comprobadas al arrancar.
 *
 * Sin esto, una variable que falta se descubre tarde: la primera vez que
 * alguien usa la función que la necesita, con un error confuso. Al arrancar
 * se avisa en el log de una vez, con los nombres de lo que falta.
 */
const NECESARIAS: { nombre: string; para: string }[] = [
  { nombre: 'DATABASE_URL', para: 'conectarse a la base de datos' },
  { nombre: 'NEXT_PUBLIC_SUPABASE_URL', para: 'iniciar sesión y guardar imágenes' },
  { nombre: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', para: 'iniciar sesión' },
  { nombre: 'SUPABASE_SERVICE_ROLE_KEY', para: 'registrar usuarios y subir imágenes' },
]

/** Las que faltan o están vacías, con para qué sirven. */
export function variablesFaltantes(
  entorno: Record<string, string | undefined> = process.env
): { nombre: string; para: string }[] {
  return NECESARIAS.filter(({ nombre }) => !entorno[nombre]?.trim())
}
