'use client'

import { useRef, useState } from 'react'
import { subirImagen, borrarImagen } from '@/lib/storage'
import { formatearPeso } from '@/lib/imagen'

interface Props {
  valor: string
  onChange: (url: string) => void
  carpeta: 'productos' | 'logos'
  etiqueta?: string
  ayuda?: string
  /**
   * Se llama solo cuando se SUBE un archivo (no al pegar una dirección), con la
   * dirección de lo subido. Sirve para saber qué imágenes son nuestras y borrar
   * las que queden huérfanas si no se guarda lo que las usaba.
   */
  onSubida?: (url: string) => void
}

export function ImageUploader({ valor, onChange, carpeta, etiqueta, ayuda, onSubida }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resumen, setResumen] = useState<string | null>(null)
  const [pegarUrl, setPegarUrl] = useState(false)

  const seleccionar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    setError(null)
    setResumen(null)
    setSubiendo(true)

    const anterior = valor

    try {
      const r = await subirImagen(archivo, carpeta)
      onChange(r.url)
      onSubida?.(r.url)
      setResumen(
        `${formatearPeso(r.pesoOriginal)} → ${formatearPeso(r.pesoFinal)} · ${r.ancho}×${r.alto} px`
      )

      // La imagen anterior queda huérfana ocupando espacio del bucket.
      if (anterior) borrarImagen(anterior).catch(() => {})
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const quitar = () => {
    const anterior = valor
    onChange('')
    setResumen(null)
    setError(null)
    if (anterior) borrarImagen(anterior).catch(() => {})
  }

  const etiquetaEstilo = {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold' as const,
  }

  return (
    <div>
      {etiqueta && <label style={etiquetaEstilo}>{etiqueta}</label>}

      {valor ? (
        <div
          style={{
            border: '1px solid var(--gray-light)',
            borderRadius: '8px',
            padding: '12px',
            backgroundColor: 'var(--beige-light)',
          }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <img
              src={valor}
              alt="Imagen del producto"
              style={{
                width: '110px',
                height: '110px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '1px solid var(--gray-light)',
                backgroundColor: 'var(--white-off)',
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              {resumen && (
                <p style={{ fontSize: '12px', color: 'var(--status-green-text)', margin: '0 0 6px 0' }}>
                  ✓ {resumen}
                </p>
              )}

              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--gray-secondary)',
                  margin: '0 0 12px 0',
                  wordBreak: 'break-all',
                }}
              >
                {valor}
              </p>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={subiendo}
                  className="btn-action"
                  style={{ cursor: subiendo ? 'wait' : 'pointer' }}
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={quitar}
                  disabled={subiendo}
                  className="btn-action danger"
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            style={{
              width: '100%',
              padding: '22px',
              border: '2px dashed var(--gray-light)',
              borderRadius: '8px',
              backgroundColor: subiendo ? 'var(--beige-light)' : 'var(--white-off)',
              cursor: subiendo ? 'wait' : 'pointer',
              color: 'var(--gray-secondary)',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          >
            {subiendo ? (
              'Procesando y subiendo...'
            ) : (
              <>
                <span style={{ fontSize: '22px', display: 'block', marginBottom: '4px' }}>📷</span>
                Elegir imagen
              </>
            )}
          </button>

          <div style={{ marginTop: '8px' }}>
            {pegarUrl ? (
              <input
                type="url"
                placeholder="https://ejemplo.com/foto.jpg"
                onChange={(e) => onChange(e.target.value.trim())}
                onBlur={() => setPegarUrl(false)}
                autoFocus
                className="field-input"
                style={{ fontSize: '13px' }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setPegarUrl(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold-dark)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                o pegar una dirección web
              </button>
            )}
          </div>
        </div>
      )}

      {ayuda && !error && <p className="field-help">{ayuda}</p>}

      {error && (
        <p style={{ fontSize: '13px', color: 'var(--status-red-solid)', marginTop: '6px' }}>{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={seleccionar}
        style={{ display: 'none' }}
      />
    </div>
  )
}
