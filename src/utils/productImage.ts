import { convertFileSrc } from '@tauri-apps/api/core'

function isTauriRuntime() {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

export function fileAssetSrc(imagePath?: string) {
  if (!imagePath) return ''
  if (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }
  return isTauriRuntime() ? convertFileSrc(imagePath) : imagePath
}

export function productImageSrc(imagePath?: string) {
  return fileAssetSrc(imagePath)
}

export function productInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}
