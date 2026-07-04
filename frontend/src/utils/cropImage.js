export function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

export async function getCroppedImg(imageSrc, croppedAreaPixels, maxOutputSize = 1200) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  let { width, height } = croppedAreaPixels

  if (width > maxOutputSize || height > maxOutputSize) {
    const scale = maxOutputSize / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  canvas.width = width
  canvas.height = height

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    width,
    height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
  })
}