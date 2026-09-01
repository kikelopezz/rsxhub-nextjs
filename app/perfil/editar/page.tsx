import { redirect } from 'next/navigation'

export default function EditarPerfilPage() {
  redirect('/perfil?edit=1')
}
