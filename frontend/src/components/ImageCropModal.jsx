import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, ZoomIn, Check } from 'lucide-react'
import { getCroppedImg } from '../utils/cropImage'

const ASPECT_OPTIONS = [
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:4', value: 3 / 4 },
]

export default function ImageCropModal({ imageSrc, mode = 'image', onCancel, onConfirm }) {
  const isAvatar = mode === 'avatar'
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspect, setAspect] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setProcessing(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, isAvatar ? 800 : 1600)
      onConfirm(blob)
    } catch (err) {
      console.error('Crop error:', err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onCancel} className="text-white p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
        <p className="text-white font-mono text-sm">{isAvatar ? 'Crop Profile Photo' : 'Crop Image'}</p>
        <button
          onClick={handleConfirm}
          disabled={processing || !croppedAreaPixels}
          className="text-accent p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-40"
        >
          {processing
            ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            : <Check className="w-5 h-5" />}
        </button>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={isAvatar ? 1 : aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          cropShape={isAvatar ? 'round' : 'rect'}
          showGrid={!isAvatar}
        />
      </div>

      <div className="shrink-0 px-4 py-4 bg-black/90 space-y-4">
        {!isAvatar && (
          <div className="flex gap-2 justify-center flex-wrap">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setAspect(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors ${
                  aspect === opt.value
                    ? 'bg-accent text-void border-accent'
                    : 'text-white border-white/30 hover:border-white/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 max-w-xs mx-auto">
          <ZoomIn className="w-4 h-4 text-white/70 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      </div>
    </div>
  )
}