// Avatar de una persona a partir de la ruta guardada en la base (CAP-95 · José, Frontend · HU-17).
//
// Teoría de Diseño de Software:
// · DIP y bajo acoplamiento (diap. 29–35 y 92–106): Avatar (ui.tsx, CAP-93) solo sabe mostrar una URL;
//   este adaptador convierte la ruta del bucket en URL con el módulo de almacenamiento (CAP-97).
//   Así el menú, el perfil y la lista de inscritos no conocen Supabase.
// · Cohesión (diap. 26–28): las tres pantallas usan este mismo componente.
import { useUrlArchivo } from '../lib/almacenamiento'
import { Avatar } from './ui'

export function AvatarUsuario({ nombre, ruta, tamano, tono, alt }: {
  nombre: string; ruta?: string | null; tamano?: string; tono?: 'claro' | 'oscuro'; alt?: string
}) {
  const url = useUrlArchivo('fotos', ruta)
  return <Avatar nombre={nombre} foto={url} tamano={tamano} tono={tono} alt={url ? alt : ''} />
}
