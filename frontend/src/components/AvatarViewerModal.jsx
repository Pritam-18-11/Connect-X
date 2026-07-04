import { X } from 'lucide-react'

export default function AvatarViewerModal({ src, name, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300">
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt={name || 'Profile photo'}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}