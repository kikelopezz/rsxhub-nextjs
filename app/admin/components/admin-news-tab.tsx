'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter, unstable_rethrow } from 'next/navigation'
import { Newspaper, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { ImagePicker } from '@/components/image-picker'
import { createNewsPostAction, updateNewsPostAction, deleteNewsPostAction } from '../actions/admin-news'
import type { NewsPostDTO } from '@/lib/news-data'

type AdminNewsTabProps = {
  posts: NewsPostDTO[]
}

export function AdminNewsTab({ posts }: AdminNewsTabProps) {
  const router = useRouter()
  const [editingPost, setEditingPost] = useState<NewsPostDTO | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formExcerpt, setFormExcerpt] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const openCreate = () => {
    setEditingPost(null)
    setFormTitle('')
    setFormExcerpt('')
    setFormBody('')
    setFormImageUrl('')
    setErrorMessage('')
    setIsModalOpen(true)
  }

  const openEdit = (post: NewsPostDTO) => {
    setEditingPost(post)
    setFormTitle(post.title)
    setFormExcerpt(post.excerpt)
    setFormBody(post.body)
    setFormImageUrl(post.imageUrl || '')
    setErrorMessage('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('title', formTitle)
      formData.set('excerpt', formExcerpt)
      formData.set('body', formBody)
      formData.set('imageUrl', formImageUrl)
      if (editingPost) formData.set('id', editingPost.id)

      const res = editingPost ? await updateNewsPostAction(formData) : await createNewsPostAction(formData)
      if (res && !res.success) {
        setErrorMessage(res.error || 'No se pudo guardar la noticia.')
        return
      }
      setIsModalOpen(false)
      router.refresh()
    } catch (err: any) {
      unstable_rethrow(err)
      setErrorMessage(err.message || 'No se pudo guardar la noticia.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (post: NewsPostDTO) => {
    if (!confirm(`¿Seguro que quieres eliminar la noticia "${post.title}"?`)) return
    try {
      const formData = new FormData()
      formData.set('id', post.id)
      await deleteNewsPostAction(formData)
      router.refresh()
    } catch (err: any) {
      unstable_rethrow(err)
      alert(err.message || 'No se pudo eliminar la noticia.')
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell-line pb-3">
        <div>
          <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Noticias</h2>
          <p className="text-xs text-slate-400">Gestiona las noticias que aparecen en la portada y en la sección "Sobre nosotros".</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-[#1274de] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#1f82ee] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir noticia
        </button>
      </div>

      <div className="overflow-x-auto border border-shell-line bg-black/10">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
              <th className="p-3">Noticia</th>
              <th className="p-3">Extracto</th>
              <th className="p-3">Publicada</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-slate-300">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center italic text-slate-500">
                  Todavía no hay noticias publicadas.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="flex items-center gap-3 p-3 font-bold text-white">
                    <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-shell-line bg-black/40">
                      {post.imageUrl ? (
                        <Image src={post.imageUrl} alt={post.title} width={64} height={40} className="h-full w-full object-cover" />
                      ) : (
                        <Newspaper className="h-4 w-4 text-slate-600" />
                      )}
                    </div>
                    <span className="max-w-[220px] truncate">{post.title}</span>
                  </td>
                  <td className="max-w-[280px] truncate p-3 text-slate-400">{post.excerpt}</td>
                  <td className="p-3 font-mono text-xxs text-slate-400">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(post)}
                        title="Editar noticia"
                        className="rounded-md border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(post)}
                        title="Eliminar noticia"
                        className="rounded-md border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-rose-500 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-2xl space-y-5 rounded-2xl border border-white/10 bg-[#0a0f18] p-6 text-white shadow-[0_0_60px_rgba(0,0,0,0.8)]">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff] cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h2 className="font-display-condensed text-xl font-bold uppercase tracking-tight text-white">
                {editingPost ? 'Editar noticia' : 'Añadir noticia'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Título</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  placeholder="ej. RSX firma un nuevo acuerdo con..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#4ea1ff]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Extracto (resumen corto)</label>
                <input
                  type="text"
                  value={formExcerpt}
                  onChange={(e) => setFormExcerpt(e.target.value)}
                  required
                  placeholder="Una frase que resuma la noticia, se muestra en el listado"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#4ea1ff]"
                />
              </div>

              <ImagePicker
                name="imageUrl"
                label="Imagen de la noticia"
                defaultValue={formImageUrl}
                onChange={setFormImageUrl}
                entityName={formTitle}
              />

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Contenido</label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  required
                  rows={8}
                  placeholder="Texto completo de la noticia..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#4ea1ff] resize-y"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-[#1274de] py-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-[#1f82ee] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : editingPost ? 'Guardar cambios' : 'Publicar noticia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
