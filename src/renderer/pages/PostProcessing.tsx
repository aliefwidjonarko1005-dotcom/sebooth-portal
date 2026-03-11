import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFrameStore, useSessionStore, useFilterStore, useAppConfig } from '../stores'
import { uploadFile, saveGallery } from '../lib/supabase'
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { sendPhotoEmail } from '../lib/email'
import { EmailModal } from '../components/EmailModal'
import { QRCodeModal } from '../components/QRCodeModal'
import { SessionTimer } from '../components/SessionTimer'
import styles from './PostProcessing.module.css'

type FilterType = 'none' | 'grayscale' | 'sepia' | 'warm' | 'cool' | 'vintage'
type MediaType = 'photo' | 'gif' | 'live'

const FILTERS: { id: FilterType; name: string; style: React.CSSProperties; filterStr: string }[] = [
    { id: 'none', name: 'Original', style: {}, filterStr: 'none' },
    { id: 'grayscale', name: 'B&W', style: { filter: 'grayscale(100%)' }, filterStr: 'grayscale(100%)' },
    { id: 'sepia', name: 'Sepia', style: { filter: 'sepia(80%)' }, filterStr: 'sepia(80%)' },
    { id: 'warm', name: 'Warm', style: { filter: 'saturate(1.3) hue-rotate(-10deg)' }, filterStr: 'saturate(1.3) hue-rotate(-10deg)' },
    { id: 'cool', name: 'Cool', style: { filter: 'saturate(1.1) hue-rotate(10deg)' }, filterStr: 'saturate(1.1) hue-rotate(10deg)' },
    { id: 'vintage', name: 'Vintage', style: { filter: 'contrast(1.1) brightness(0.9) sepia(30%)' }, filterStr: 'contrast(1.1) brightness(0.9) sepia(30%)' }
]

function PostProcessing(): JSX.Element {
    const navigate = useNavigate()
    const { frames, activeFrame } = useFrameStore()
    const { photos, currentSession, setCompositePath, setEmail, endSession } = useSessionStore()
    const { filters: lutFilters } = useFilterStore()
    const { config } = useAppConfig()

    // Use frame from session, fallback to activeFrame
    const sessionFrame = currentSession?.frameId
        ? frames.find(f => f.id === currentSession.frameId)
        : activeFrame

    const [selectedFilter, setSelectedFilter] = useState<FilterType>('none')
    const [activeTab, setActiveTab] = useState<MediaType>('photo')
    const [isPrinting, setIsPrinting] = useState(false)
    const [printQuantity, setPrintQuantity] = useState(2)
    const [showSuccess, setShowSuccess] = useState(false)
    const [compositeDataUrl, setCompositeDataUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showEmailModal, setShowEmailModal] = useState(false)
    const [lastEmail, setLastEmail] = useState('')
    const [showQRModal, setShowQRModal] = useState(false)
    const [qrPhotoUrl, setQrPhotoUrl] = useState<string | null>(null)
    const [isGeneratingQR, setIsGeneratingQR] = useState(false)
    const [isSendingEmail, setIsSendingEmail] = useState(false)
    const [galleryUrl, setGalleryUrl] = useState<string | null>(null)
    const [photoStripUrl, setPhotoStripUrl] = useState<string | null>(null)
    const [gifUrl, setGifUrl] = useState<string | null>(null)
    const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([])
    const [sessionSavedLocally, setSessionSavedLocally] = useState(false)

    // For GIF/Live preview
    const [previewIndex, setPreviewIndex] = useState(0)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Generate composite when photos, frame, or filter changes
    useEffect(() => {
        if (photos.length > 0 && sessionFrame) {
            generateCompositeFromPhotos()
        }
    }, [photos, sessionFrame, selectedFilter])

    // Handle GIF/Live preview animation
    useEffect(() => {
        if (activeTab === 'gif' || activeTab === 'live') {
            const intervalTime = activeTab === 'gif' ? 500 : 200 // Faster for live/boomerang
            previewIntervalRef.current = setInterval(() => {
                setPreviewIndex(prev => (prev + 1) % photos.length)
            }, intervalTime)
        } else {
            setPreviewIndex(0)
            if (previewIntervalRef.current) clearInterval(previewIntervalRef.current)
        }

        return () => {
            if (previewIntervalRef.current) clearInterval(previewIntervalRef.current)
        }
    }, [activeTab, photos.length])

    // Auto-save session locally when composite is generated
    useEffect(() => {
        if (!compositeDataUrl || !currentSession || sessionSavedLocally) return

        const autoSave = async () => {
            try {
                const sessionId = currentSession.id
                const timestamp = Date.now()

                const photoRefs = photos.map((p, i) => ({
                    path: p.imagePath,
                    filename: `photo_${sessionId}_${i}_${timestamp}.jpg`
                }))

                // Generate GIF from photos
                let gifDataUrl = ''
                if (photos.length > 0 && sessionFrame) {
                    try {
                        const gifCanvas = document.createElement('canvas')
                        const firstSlot = sessionFrame.slots?.[0]
                        const slotAspect = firstSlot ? (firstSlot.width / firstSlot.height) : 1.5
                        gifCanvas.width = 1080
                        gifCanvas.height = Math.round(1080 / slotAspect)
                        const gctx = gifCanvas.getContext('2d', { willReadFrequently: true, alpha: false })
                        if (gctx) {
                            gctx.imageSmoothingEnabled = true
                            gctx.imageSmoothingQuality = 'high'
                            const framesBase64: string[] = []
                            for (const photo of photos) {
                                const img = new Image()
                                img.crossOrigin = 'anonymous'
                                img.src = photo.imagePath
                                await new Promise(r => { img.onload = r })
                                const imgAspect = img.width / img.height
                                const canvasAspect = gifCanvas.width / gifCanvas.height
                                let dw = gifCanvas.width, dh = gifCanvas.height, dx = 0, dy = 0
                                if (imgAspect > canvasAspect) {
                                    dh = gifCanvas.height; dw = gifCanvas.height * imgAspect; dx = (gifCanvas.width - dw) / 2
                                } else {
                                    dw = gifCanvas.width; dh = gifCanvas.width / imgAspect; dy = (gifCanvas.height - dh) / 2
                                }
                                gctx.fillStyle = '#ffffff'
                                gctx.fillRect(0, 0, gifCanvas.width, gifCanvas.height)
                                gctx.drawImage(img, dx, dy, dw, dh)
                                framesBase64.push(gifCanvas.toDataURL('image/jpeg', 0.95))
                            }
                            if (window.api.system.generateHqGif) {
                                const hqGifResult = await window.api.system.generateHqGif(framesBase64, 500)
                                if (hqGifResult.success && hqGifResult.data) {
                                    gifDataUrl = hqGifResult.data
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Auto-save GIF gen failed:', e)
                    }
                }

                // Collect video refs and overlay for live video compositing
                const videoRefs: { path: string; filename: string }[] = []
                let hasVideoRecordings = false
                let overlayRef: { path: string; filename: string } | undefined

                if (sessionFrame) {
                    for (const slot of sessionFrame.slots) {
                        const sourceSlotId = slot.duplicateOfSlotId || slot.id
                        const photoInfo = photos.find(p => p.slotId === sourceSlotId)
                        if (photoInfo?.videoPath && !photoInfo.videoPath.startsWith('blob:')) {
                            hasVideoRecordings = true
                            videoRefs.push({
                                path: photoInfo.videoPath,
                                filename: `video_${sessionId}_${slot.id}_${timestamp}.webm`
                            })
                        } else {
                            videoRefs.push({ path: '', filename: '' })
                        }
                    }

                    if (hasVideoRecordings && sessionFrame.overlayPath) {
                        overlayRef = { path: sessionFrame.overlayPath, filename: `frame_${sessionId}_${timestamp}.png` }
                    }
                }

                const localSaveRes = await window.api.system.saveSessionLocally({
                    sessionId,
                    stripDataUrl: compositeDataUrl,
                    gifDataUrl: gifDataUrl || undefined,
                    photos: photoRefs,
                    videos: videoRefs,
                    overlay: overlayRef,
                    frameConfig: sessionFrame ? {
                        width: sessionFrame.canvasWidth,
                        height: sessionFrame.canvasHeight,
                        slots: sessionFrame.slots.map(s => ({ width: s.width, height: s.height, x: s.x, y: s.y, rotation: s.rotation || 0 }))
                    } : undefined
                })

                if (localSaveRes.success) {
                    setSessionSavedLocally(true)
                    console.log('Session auto-saved locally (with GIF/video)')
                }
            } catch (err) {
                console.error('Auto-save failed:', err)
            }
        }

        autoSave()
    }, [compositeDataUrl, currentSession, sessionSavedLocally])

    // Generate composite from photos using canvas
    const generateCompositeFromPhotos = async (): Promise<void> => {
        if (!sessionFrame || photos.length === 0 || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size to frame dimensions
        canvas.width = sessionFrame.canvasWidth
        canvas.height = sessionFrame.canvasHeight

        // Fill background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image()
                img.crossOrigin = 'anonymous'
                img.onload = () => resolve(img)
                img.onerror = reject
                img.src = src
            })
        }

        try {
            // Apply Filter to Context BEFORE drawing photos
            // The user requested the filter to apply to photos. 
            // If they want it on the overlay too, we keep it enabled.
            // As per "Filter only applies to photo", we should ensure it applies to what they expect.
            // Baking it into the canvas ensures WYSIWYG for print/email.
            const filterDef = FILTERS.find(f => f.id === selectedFilter)
            if (filterDef && filterDef.id !== 'none') {
                ctx.filter = filterDef.filterStr
            } else {
                ctx.filter = 'none'
            }

            // Draw photos to all slots (including duplicates)
            for (const slot of sessionFrame.slots) {
                // For duplicate slots, find the source slot's photo
                const sourceSlotId = slot.duplicateOfSlotId || slot.id
                const photo = photos.find(p => p.slotId === sourceSlotId)
                if (!photo) continue

                try {
                    const img = await loadImage(photo.imagePath)

                    ctx.save()
                    // Translate to CENTER of slot
                    ctx.translate(slot.x + slot.width / 2, slot.y + slot.height / 2)
                    ctx.rotate((slot.rotation * Math.PI) / 180)

                    // Create clipping path to constrain photo to slot bounds
                    ctx.beginPath()
                    ctx.rect(-slot.width / 2, -slot.height / 2, slot.width, slot.height)
                    ctx.clip()

                    // Cover fit: scale to fill entire slot, crop excess
                    const imgAspect = img.width / img.height
                    const slotAspect = slot.width / slot.height
                    let drawWidth, drawHeight

                    if (imgAspect > slotAspect) {
                        // Image is wider: match height, let width overflow and get clipped
                        drawHeight = slot.height
                        drawWidth = slot.height * imgAspect
                    } else {
                        // Image is taller: match width, let height overflow and get clipped
                        drawWidth = slot.width
                        drawHeight = slot.width / imgAspect
                    }

                    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
                    ctx.restore()
                } catch (err) {
                    console.error('Failed to load photo:', err)
                }
            }

            // Draw frame overlay
            try {
                // Reset filter before drawing overlay - filter only applies to photos
                ctx.filter = 'none'

                const frameImg = await loadImage(`file://${sessionFrame.overlayPath}`)

                // Draw Frame using "Contain" logic to prevent stretching if aspects mismatch
                // Ideally frame matches canvas size exactly.
                const frameAspect = frameImg.width / frameImg.height
                const canvasAspect = canvas.width / canvas.height

                let fw = canvas.width
                let fh = canvas.height
                let fx = 0
                let fy = 0

                // If massive mismatch, center contain
                if (Math.abs(frameAspect - canvasAspect) > 0.01) {
                    if (frameAspect > canvasAspect) {
                        // Frame wider than canvas -> Fit Width
                        fw = canvas.width
                        fh = canvas.width / frameAspect
                        fy = (canvas.height - fh) / 2
                    } else {
                        // Frame taller -> Fit Height
                        fh = canvas.height
                        fw = canvas.height * frameAspect
                        fx = (canvas.width - fw) / 2
                    }
                }

                ctx.drawImage(frameImg, fx, fy, fw, fh)

            } catch (err) {
                console.error('Failed to load frame overlay:', err)
            }

            // Get composite as data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
            setCompositeDataUrl(dataUrl)
            setCompositePath(dataUrl)
        } catch (error) {
            console.error('Failed to generate composite:', error)
            setError('Failed to generate composite image')
        }
    }

    // Handle print - uses session folder strip for proper PDF logging
    const handlePrint = async (): Promise<void> => {
        if (!compositeDataUrl || !currentSession) return

        setIsPrinting(true)
        setError(null)

        try {
            // Find strip in session folder (auto-saved earlier)
            let stripPath: string | null = null
            try {
                const findResult = await window.api.system.findSessionStrip(currentSession.id)
                if (findResult.success && findResult.data) {
                    stripPath = findResult.data
                }
            } catch { /* ignore, use fallback */ }

            // Fallback: save to temp if session strip not found
            if (!stripPath) {
                const saveResult = await window.api.system.saveDataUrl(
                    compositeDataUrl,
                    `strip_${currentSession.id}.jpg`
                )
                if (saveResult.success && saveResult.data) {
                    stripPath = saveResult.data
                }
            }

            if (stripPath) {
                // printQuantity = number of strips (2 strips per sheet)
                const copies = Math.max(1, Math.round(printQuantity / 2))
                const result = await window.api.printer.printWithOptions(stripPath, {
                    printer: config.printerName || undefined,
                    copies
                })
                if (!result.success) {
                    setError(result.error || 'Print failed')
                }
            } else {
                setError('Failed to find or save strip for printing')
            }
        } catch (err) {
            setError('Print failed: ' + (err as Error).message)
        } finally {
            setIsPrinting(false)
        }
    }

    // Handle QR code generation - save locally, upload to Google Drive, and fallback to Supabase if needed
    const handleGenerateQR = async (): Promise<void> => {
        if (!compositeDataUrl || !currentSession || !window.api.drive || !window.api.system.saveSessionLocally) return

        setIsGeneratingQR(true)
        setQrPhotoUrl(null)
        setShowQRModal(true)

        try {
            const sessionId = currentSession.id
            const timestamp = Date.now()

            // 0. Generate GIF data URL
            let gifDataUrl = ''
            if (photos.length > 0) {
                try {
                    const gifCanvas = document.createElement('canvas')

                    // High-Quality GIF: Use the first photo's native dimensions or frame aspect ratio
                    const firstSlot = sessionFrame?.slots?.[0]
                    const slotAspect = firstSlot ? (firstSlot.width / firstSlot.height) : 1.5

                    // Maximize resolution, typically photobooths run at 1080p width
                    gifCanvas.width = 1080
                    gifCanvas.height = Math.round(1080 / slotAspect)

                    // Force high-quality interpolation
                    const gctx = gifCanvas.getContext('2d', { willReadFrequently: true, alpha: false })
                    if (gctx) {
                        gctx.imageSmoothingEnabled = true
                        gctx.imageSmoothingQuality = 'high'

                        // Apply active filter
                        const filterDef = FILTERS.find(f => f.id === selectedFilter)
                        if (filterDef && filterDef.id !== 'none') {
                            gctx.filter = filterDef.filterStr
                        } else {
                            gctx.filter = 'none'
                        }

                        const framesBase64: string[] = []

                        for (const photo of photos) {
                            const img = new Image()
                            img.crossOrigin = 'anonymous'
                            img.src = photo.imagePath
                            await new Promise(r => img.onload = r)

                            // Cover fit onto canvas exactly as shot
                            const imgAspect = img.width / img.height
                            const canvasAspect = gifCanvas.width / gifCanvas.height
                            let dw = gifCanvas.width, dh = gifCanvas.height, dx = 0, dy = 0

                            if (imgAspect > canvasAspect) {
                                dh = gifCanvas.height
                                dw = gifCanvas.height * imgAspect
                                dx = (gifCanvas.width - dw) / 2
                            } else {
                                dw = gifCanvas.width
                                dh = gifCanvas.width / imgAspect
                                dy = (gifCanvas.height - dh) / 2
                            }

                            gctx.fillStyle = '#ffffff'
                            gctx.fillRect(0, 0, gifCanvas.width, gifCanvas.height)
                            gctx.drawImage(img, dx, dy, dw, dh)

                            // Push frame as high-quality JPEG base64
                            const frameDataUrl = gifCanvas.toDataURL('image/jpeg', 0.95)
                            framesBase64.push(frameDataUrl)
                        }

                        // Generate true GIF using FFmpeg in backend
                        if (window.api.system.generateHqGif) {
                            const hqGifResult = await window.api.system.generateHqGif(framesBase64, 500)
                            if (hqGifResult.success && hqGifResult.data) {
                                gifDataUrl = hqGifResult.data
                            } else {
                                console.error('FFmpeg GIF Gen Failed:', hqGifResult.error)
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to generate GIF:', e)
                }
            }

            // 1. Collect file references from the frontend
            const photoRefs = photos.map((p, i) => ({
                path: p.imagePath,
                filename: `photo_${sessionId}_${i}_${timestamp}.jpg`
            }))

            const videoRefs: { path: string; filename: string }[] = []
            let hasVideoRecordings = false;

            if (sessionFrame) {
                // Map videos to each slot exactly, supporting duplicates
                for (const slot of sessionFrame.slots) {
                    const sourceSlotId = slot.duplicateOfSlotId || slot.id
                    const photoInfo = photos.find(p => p.slotId === sourceSlotId)

                    if (photoInfo?.videoPath && !photoInfo.videoPath.startsWith('blob:')) {
                        hasVideoRecordings = true;
                        videoRefs.push({
                            path: photoInfo.videoPath,
                            filename: `video_${sessionId}_${slot.id}_${timestamp}.webm`
                        })
                    } else {
                        videoRefs.push({ path: '', filename: '' }) // Maintain array alignment with slots
                    }
                }
            } else {
                // Fallback mapping if no sessionFrame 
                const uniqueVideos = new Set<string>()
                for (const photo of photos) {
                    if (photo.videoPath && !photo.videoPath.startsWith('blob:') && !uniqueVideos.has(photo.videoPath)) {
                        uniqueVideos.add(photo.videoPath)
                        hasVideoRecordings = true;
                        videoRefs.push({
                            path: photo.videoPath,
                            filename: `video_${sessionId}_${photo.slotId}_${timestamp}.webm`
                        })
                    }
                }
            }

            const overlayRef = (sessionFrame && sessionFrame.overlayPath && hasVideoRecordings)
                ? { path: sessionFrame.overlayPath, filename: `frame_${sessionId}_${timestamp}.png` }
                : undefined

            // 2. Save everything locally first! 
            const localSaveRes = await window.api.system.saveSessionLocally({
                sessionId,
                stripDataUrl: compositeDataUrl,
                gifDataUrl: gifDataUrl || undefined,
                photos: photoRefs,
                videos: videoRefs,
                overlay: overlayRef,
                frameConfig: sessionFrame ? {
                    width: sessionFrame.canvasWidth,
                    height: sessionFrame.canvasHeight,
                    slots: sessionFrame.slots.map(s => ({ width: s.width, height: s.height, x: s.x, y: s.y, rotation: s.rotation || 0 }))
                } : undefined
            })

            if (!localSaveRes.success || !localSaveRes.data) {
                throw new Error(localSaveRes.error || 'Failed to save session locally')
            }

            const savedLocalFiles = localSaveRes.data

            // LOCAL WIFI (OFFLINE) ROUTING 📶
            if (config.sharingMode === 'local') {
                console.log('Using Local WiFi Sharing mode.')
                const ipRes = await window.api.system.getLocalIp()
                if (ipRes.success && ipRes.data) {
                    const localIp = ipRes.data
                    const localUrl = `http://${localIp}:5050/gallery/${sessionId}`

                    setQrPhotoUrl(localUrl)
                    setGalleryUrl(localUrl)

                    // The Express server serves these exact filenames directly out of the sessionId folder
                    const uploadedStrip = savedLocalFiles.find((f: { filename: string }) => f.filename.startsWith('strip_'))
                    setPhotoStripUrl(uploadedStrip ? `http://${localIp}:5050/Session_${sessionId}/${uploadedStrip.filename}` : null)

                    const uploadedGif = savedLocalFiles.find((f: { filename: string }) => f.filename.startsWith('gif_'))
                    setGifUrl(uploadedGif ? `http://${localIp}:5050/Session_${sessionId}/${uploadedGif.filename}` : null)

                    const videoFile = savedLocalFiles.find((f: { filename: string }) => f.filename.startsWith('live_video_'))

                    const uploadedPhotos = savedLocalFiles.filter((f: { filename: string }) => f.filename.startsWith('photo_')).map((f: { filename: string }) => `http://${localIp}:5050/Session_${sessionId}/${f.filename}`)
                    setUploadedPhotoUrls(uploadedPhotos)

                    await saveGallery({
                        sessionId,
                        photoStripUrl: uploadedStrip ? `http://${localIp}:5050/Session_${sessionId}/${uploadedStrip.filename}` : undefined,
                        gifUrl: uploadedGif ? `http://${localIp}:5050/Session_${sessionId}/${uploadedGif.filename}` : undefined,
                        livePhotoUrl: videoFile ? `http://${localIp}:5050/Session_${sessionId}/${videoFile.filename}` : undefined,
                        photoUrls: uploadedPhotos
                    })

                    setIsGeneratingQR(false)
                    return // Done successfully without cloud uploads!
                } else {
                    console.warn('Failed to get local IP for WiFi sharing, falling back to cloud.', ipRes.error)
                }
            }

            // 3. Try uploading to Google Drive
            try {
                const driveRes = await window.api.drive.uploadSession({ sessionId, files: savedLocalFiles })

                if (driveRes.success && driveRes.folderUrl) {
                    // Google Drive upload succeeded!
                    const driveFolderUrl = driveRes.folderUrl
                    setQrPhotoUrl(driveFolderUrl)
                    setGalleryUrl(driveFolderUrl)

                    const uploadedStrip = driveRes.files?.find((f: { filename: string; url: string; id: string }) => f.filename.startsWith('strip_'))
                    setPhotoStripUrl(uploadedStrip?.url || null)

                    const uploadedGif = driveRes.files?.find((f: { filename: string; url: string; id: string }) => f.filename.startsWith('gif_'))
                    setGifUrl(uploadedGif?.url || null)

                    const uploadedVideo = driveRes.files?.find((f: { filename: string; url: string; id: string }) => f.filename.startsWith('live_video_'))

                    const uploadedPhotos = driveRes.files?.filter((f: { filename: string; url: string; id: string }) => f.filename.startsWith('photo_')).map((f: { filename: string; url: string; id: string }) => f.url) || []
                    setUploadedPhotoUrls(uploadedPhotos)

                    await saveGallery({
                        sessionId,
                        photoStripUrl: uploadedStrip?.url,
                        gifUrl: uploadedGif?.url,
                        livePhotoUrl: uploadedVideo?.url,
                        photoUrls: uploadedPhotos
                    })

                    setIsGeneratingQR(false)
                    return // Done successfully
                } else {
                    console.warn('Drive upload failed, falling back to Supabase:', driveRes.error)
                }
            } catch (driveErr) {
                console.warn('Drive upload threw error, falling back to Supabase:', driveErr)
            }

            // 4. Fallback to Supabase if Google Drive failed (e.g. 403 Forbidden)
            console.log('Running Supabase upload fallback...')
            let photoStripUrl: string | undefined
            let gifFallbackUrl: string | undefined
            let videoFallbackUrl: string | undefined
            const photoUrls: string[] = []

            for (const file of savedLocalFiles) {
                try {
                    // Read file securely via IPC bridge instead of browser fetch(file://) 
                    const base64Res = await window.api.system.readFileAsBase64(file.path)
                    if (!base64Res.success || !base64Res.data) {
                        console.error('Failed to read file for Supabase fallback upload:', base64Res.error)
                        continue
                    }

                    const fetchRes = await fetch(`data:${file.mimeType};base64,${base64Res.data}`)
                    const blob = await fetchRes.blob()

                    const uploadResult = await uploadFile('exports', file.filename, blob)

                    if (uploadResult && 'url' in uploadResult) {
                        if (file.filename.startsWith('strip_')) {
                            photoStripUrl = uploadResult.url
                        } else if (file.filename.startsWith('gif_')) {
                            gifFallbackUrl = uploadResult.url
                        } else if (file.filename.startsWith('live_video_')) {
                            videoFallbackUrl = uploadResult.url
                        } else if (file.filename.startsWith('photo_')) {
                            photoUrls.push(uploadResult.url)
                        }
                    }
                } catch (e) {
                    console.error('Fallback upload failed for file:', file.filename, e)
                }
            }

            // Fallback to direct photo strip URL since Vercel gallery is down
            const fallbackUrl = photoStripUrl || photoUrls[0] || ''

            setQrPhotoUrl(fallbackUrl)
            setGalleryUrl(fallbackUrl)
            setPhotoStripUrl(photoStripUrl || null)
            setGifUrl(gifFallbackUrl || null)
            setUploadedPhotoUrls(photoUrls)

            await saveGallery({
                sessionId,
                photoStripUrl,
                gifUrl: gifFallbackUrl,
                livePhotoUrl: videoFallbackUrl,
                photoUrls
            })

        } catch (err) {
            console.error('QR generation error:', err)
            setQrPhotoUrl(null)
        } finally {
            setIsGeneratingQR(false)
        }
    }

    // Handle sending email with photos
    const handleSendEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
        if (!currentSession) {
            return { success: false, error: 'No active session' }
        }

        setIsSendingEmail(true)
        try {
            const result = await sendPhotoEmail({
                to: email,
                sessionId: currentSession.id,
                galleryUrl: galleryUrl || '',
                photoStripUrl: photoStripUrl || undefined,
                photoUrls: uploadedPhotoUrls
            })

            if (result.success) {
                // Save email to session store
                setEmail(email)
                setLastEmail(email)

                // Rename the session folder to include email
                await window.api.system.renameSessionFolder({
                    sessionId: currentSession.id,
                    email
                })
            }

            return result
        } catch (err) {
            const error = err as Error
            return { success: false, error: error.message }
        } finally {
            setIsSendingEmail(false)
        }
    }

    // Generate HTML gallery page content
    const generateGalleryHtml = (data: {
        photoStripUrl?: string
        gifUrl?: string
        livePhotoUrl?: string
        photoUrls: string[]
        sessionId: string
        timestamp: number
    }): string => {
        const dateStr = new Date(data.timestamp).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })

        const photosHtml = data.photoUrls.map((url, i) => `
            <div class="photo-card">
                <img src="${url}" alt="Photo ${i + 1}" onclick="openImage('${url}')">
                <a href="${url}" download="photo_${i + 1}.jpg" class="download-btn">⬇️ Download</a>
            </div>
        `).join('')

        return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sebooth Gallery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        .header {
            text-align: center;
            padding: 20px 0;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { color: rgba(255,255,255,0.6); font-size: 14px; }
        .tabs {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        .tab {
            padding: 10px 20px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            background: transparent;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            font-size: 14px;
        }
        .tab.active { background: linear-gradient(135deg, #6366f1, #8b5cf6); border-color: transparent; color: white; }
        .content { max-width: 500px; margin: 0 auto; }
        .section { display: none; text-align: center; }
        .section.active { display: block; }
        .main-media {
            width: 100%;
            max-height: 70vh;
            object-fit: contain;
            border-radius: 12px;
            margin-bottom: 16px;
        }
        .download-btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #10b981, #059669);
            border: none;
            border-radius: 8px;
            color: white;
            text-decoration: none;
            font-weight: 600;
        }
        .photos-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        .photo-card {
            position: relative;
            border-radius: 8px;
            overflow: hidden;
        }
        .photo-card img {
            width: 100%;
            aspect-ratio: 1;
            object-fit: cover;
            cursor: pointer;
        }
        .photo-card .download-btn {
            position: absolute;
            bottom: 8px;
            right: 8px;
            padding: 6px 10px;
            font-size: 12px;
        }
        .footer {
            text-align: center;
            padding: 30px 0;
            color: rgba(255,255,255,0.4);
            font-size: 12px;
        }
        .modal {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 100;
            justify-content: center;
            align-items: center;
        }
        .modal.open { display: flex; }
        .modal img { max-width: 95%; max-height: 95%; object-fit: contain; }
        .modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>📸 Your Photos</h1>
        <p>${dateStr}</p>
    </header>

    <nav class="tabs">
        ${data.photoStripUrl ? '<button class="tab active" onclick="showSection(\'strip\')">🖼️ Photo Strip</button>' : ''}
        ${data.gifUrl ? `<button class="tab ${!data.photoStripUrl ? 'active' : ''}" onclick="showSection('gif')">✨ GIF</button>` : ''}
        ${data.livePhotoUrl ? `<button class="tab ${!data.photoStripUrl && !data.gifUrl ? 'active' : ''}" onclick="showSection('live')">📱 Live Photo</button>` : ''}
        ${data.photoUrls.length > 0 ? `<button class="tab ${!data.photoStripUrl && !data.gifUrl && !data.livePhotoUrl ? 'active' : ''}" onclick="showSection('photos')">📷 Photos (${data.photoUrls.length})</button>` : ''}
    </nav>

    <main class="content">
        ${data.photoStripUrl ? `
        <section id="strip" class="section active">
            <img src="${data.photoStripUrl}" alt="Photo Strip" class="main-media" onclick="openImage('${data.photoStripUrl}')">
            <a href="${data.photoStripUrl}" download="photostrip.jpg" class="download-btn">⬇️ Download Photo Strip</a>
        </section>
        ` : ''}

        ${data.gifUrl ? `
        <section id="gif" class="section ${!data.photoStripUrl ? 'active' : ''}">
            <img src="${data.gifUrl}" alt="GIF Animation" class="main-media" onclick="openImage('${data.gifUrl}')">
            <a href="${data.gifUrl}" download="animation.gif" class="download-btn">⬇️ Download GIF</a>
        </section>
        ` : ''}

        ${data.livePhotoUrl ? `
        <section id="live" class="section ${!data.photoStripUrl && !data.gifUrl ? 'active' : ''}">
            <video src="${data.livePhotoUrl}" autoplay loop muted playsinline class="main-media"></video>
            <a href="${data.livePhotoUrl}" download="livephoto.mp4" class="download-btn">⬇️ Download Live Photo</a>
        </section>
        ` : ''}

        ${data.photoUrls.length > 0 ? `
        <section id="photos" class="section ${!data.photoStripUrl && !data.gifUrl && !data.livePhotoUrl ? 'active' : ''}">
            <div class="photos-grid">
                ${photosHtml}
            </div>
        </section>
        ` : ''}
    </main>

    <footer class="footer">Powered by Sebooth</footer>

    <div id="modal" class="modal" onclick="closeModal()">
        <button class="modal-close" onclick="closeModal()">×</button>
        <img id="modal-img" src="">
    </div>

    <script>
        function showSection(id) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            event.target.classList.add('active');
        }
        function openImage(url) {
            document.getElementById('modal-img').src = url;
            document.getElementById('modal').classList.add('open');
        }
        function closeModal() {
            document.getElementById('modal').classList.remove('open');
        }
    </script>
</body>
</html>`
    }

    // Handle done / restart
    const handleDone = (): void => {
        endSession()
        navigate('/')
    }

    // Show loading if no photos
    if (photos.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.noPhotos}>
                    <h2>No Photos</h2>
                    <p>Please take some photos first.</p>
                    <button onClick={() => navigate('/frames')}>Start Over</button>
                </div>
            </div>
        )
    }

    if (showSuccess) {
        return (
            <motion.div
                className={styles.successScreen}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <motion.div
                    className={styles.successContent}
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                >
                    <span className={styles.successIcon}>✉️</span>
                    <h2>Photo Sent!</h2>
                    <p>Check your email at <strong>{lastEmail}</strong></p>
                    <p className={styles.countdown}>Returning to start in 5 seconds...</p>
                </motion.div>
            </motion.div>
        )
    }

    // Render Preview Logic
    const renderPreview = () => {
        if (activeTab === 'photo') {
            return compositeDataUrl ? (
                <img
                    src={compositeDataUrl}
                    alt="Composite Preview"
                    className={styles.previewImage}
                />
            ) : (
                <div className={styles.loadingPreview}>
                    <span className={styles.spinner} />
                    Generating preview...
                </div>
            )
        } else if (activeTab === 'gif') {
            // GIF Preview - Slideshow of individual photos
            const currentPhoto = photos[previewIndex]
            return currentPhoto ? (
                <>
                    <img
                        src={currentPhoto.imagePath}
                        alt="GIF Frame"
                        className={styles.previewImage}
                        style={{
                            filter: FILTERS.find(f => f.id === selectedFilter)?.filterStr || 'none'
                        }}
                    />
                    <div className={styles.previewOverlayMode}>
                        GIF Preview ({previewIndex + 1}/{photos.length})
                    </div>
                </>
            ) : (
                <div className={styles.loadingPreview}>
                    <span>🎞️</span>
                    No photos for GIF
                </div>
            )
        } else {
            // Live Photo Preview - Harry Potter style: videos playing within frame slots
            if (!sessionFrame) return null

            const hasVideos = photos.some(p => p.videoPath)
            if (!hasVideos) {
                // Fallback to static composite if no videos available
                return compositeDataUrl ? (
                    <>
                        <img
                            src={compositeDataUrl}
                            alt="Live Photo Preview"
                            className={styles.previewImage}
                        />
                        <div className={styles.previewOverlayMode}>
                            Live Photo (No video available)
                        </div>
                    </>
                ) : (
                    <div className={styles.loadingPreview}>
                        <span>📹</span>
                        No Live Photo videos available
                    </div>
                )
            }

            // Show videos playing within frame template like Harry Potter paintings
            return (
                <div
                    className={styles.livePhotoMontage}
                    style={{
                        aspectRatio: `${sessionFrame.canvasWidth} / ${sessionFrame.canvasHeight}`,
                        width: '100%',
                        height: '100%'
                    }}
                >
                    {/* Videos positioned in ALL slots (behind overlay) - duplicates use source video */}
                    {sessionFrame.slots.map(slot => {
                        // For duplicate slots, find the source slot's photo
                        const sourceSlotId = slot.duplicateOfSlotId || slot.id
                        const photo = photos.find(p => p.slotId === sourceSlotId)
                        if (!photo || !photo.videoPath) return null

                        return (
                            <video
                                key={slot.id}
                                src={photo.videoPath}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className={styles.videoSlot}
                                style={{
                                    left: `${(slot.x / sessionFrame.canvasWidth) * 100}%`,
                                    top: `${(slot.y / sessionFrame.canvasHeight) * 100}%`,
                                    width: `${(slot.width / sessionFrame.canvasWidth) * 100}%`,
                                    height: `${(slot.height / sessionFrame.canvasHeight) * 100}%`,
                                    transform: `rotate(${slot.rotation}deg)`,
                                    transformOrigin: 'center center',
                                    filter: FILTERS.find(f => f.id === selectedFilter)?.filterStr || 'none'
                                }}
                                poster={photo.imagePath}
                            />
                        )
                    })}

                    {/* Frame overlay on top */}
                    <img
                        src={`file://${sessionFrame.overlayPath}`}
                        alt="Frame"
                        className={styles.montageOverlay}
                    />

                    <div className={styles.previewOverlayMode}>
                        Live Photo Preview ⚡
                    </div>
                </div>
            )
        }
    }

    return (
        <motion.div
            className={styles.container}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Session Timer Overlay */}
            <SessionTimer
                duration={config.postProcessingTimeout}
                onTimeout={handleDone}
                enabled={config.sessionTimerEnabled}
                label="Post Processing"
            />

            {/* Hidden canvas for compositing */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Left Toolbar (Mode Toggles) */}
            <aside className={styles.leftToolbar}>
                <button
                    className={`${styles.modeBtn} ${activeTab === 'photo' ? styles.active : ''}`}
                    onClick={() => setActiveTab('photo')}
                >
                    <span className={styles.modeIcon}>📷</span>
                    Photo
                </button>
                <button
                    className={`${styles.modeBtn} ${activeTab === 'gif' ? styles.active : ''}`}
                    onClick={() => setActiveTab('gif')}
                >
                    <span className={styles.modeIcon}>🎞️</span>
                    GIF
                </button>
                <button
                    className={`${styles.modeBtn} ${activeTab === 'live' ? styles.active : ''}`}
                    onClick={() => setActiveTab('live')}
                >
                    <span className={styles.modeIcon}>⚡</span>
                    Live
                </button>
            </aside>

            {/* Preview Section */}
            <div className={styles.previewSection}>
                {/* Note: We no longer apply style={selectedFilterStyle} to the container
                    because we baked the filter into the image/canvas itself. 
                */}
                <div
                    className={styles.previewFrame}
                    style={{
                        aspectRatio: activeTab === 'gif' 
                            ? 'auto' 
                            : (sessionFrame ? `${sessionFrame.canvasWidth} / ${sessionFrame.canvasHeight}` : 'auto'),
                        width: activeTab === 'gif' ? '100%' : 'auto'
                    }}
                >
                    {renderPreview()}
                </div>
            </div>

            {/* Right Sidebar */}
            <aside className={styles.sidebar}>
                {/* Photo Strip */}
                <div className={styles.sidebarSection}>
                    <h3>Your Photos</h3>
                    <div className={styles.photoGrid}>
                        {photos.map((photo, index) => (
                            <div key={photo.slotId} className={styles.photoThumb}>
                                <img src={photo.imagePath} alt={`Photo ${index + 1}`} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Filter Selection */}
                <div className={styles.sidebarSection}>
                    <h3>Filters</h3>
                    <div className={styles.filterGrid}>
                        {FILTERS.map(filter => (
                            <button
                                key={filter.id}
                                className={`${styles.filterBtn} ${selectedFilter === filter.id ? styles.selected : ''}`}
                                onClick={() => setSelectedFilter(filter.id)}
                            >
                                <div className={styles.filterPreview} style={filter.style}>
                                    {photos[0] && <img src={photos[0].imagePath} alt={filter.name} />}
                                </div>
                                <span>{filter.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className={styles.sidebarActions}>
                    {error && <div className={styles.errorMessage}>{error}</div>}

                    <button
                        className={styles.actionBtn}
                        onClick={() => setShowEmailModal(true)}
                        disabled={!compositeDataUrl}
                    >
                        📧 Send to Email
                    </button>

                    <button
                        className={styles.actionBtn}
                        onClick={handleGenerateQR}
                        disabled={!compositeDataUrl || isGeneratingQR}
                    >
                        {isGeneratingQR ? 'Generating...' : '📱 QR Code'}
                    </button>

                    <div className={styles.printRow}>
                        <button
                            className={styles.actionBtn}
                            onClick={handlePrint}
                            disabled={isPrinting || !compositeDataUrl}
                        >
                            {isPrinting ? 'Printing...' : '🖨️ Print Photo'}
                        </button>
                        <div className={styles.quantitySelector}>
                            <button
                                className={styles.qtyBtn}
                                onClick={() => setPrintQuantity(q => Math.max(2, q - 2))}
                                disabled={printQuantity <= 2}
                            >−</button>
                            <span className={styles.qtyValue}>{printQuantity} strips</span>
                            <button
                                className={styles.qtyBtn}
                                onClick={() => setPrintQuantity(q => q + 2)}
                            >+</button>
                        </div>
                    </div>

                    <button onClick={handleDone} className={`${styles.actionBtn} ${styles.primary}`}>
                        ✓ Done
                    </button>
                </div>
            </aside>

            {/* Email Modal */}
            <EmailModal
                isOpen={showEmailModal}
                onClose={() => setShowEmailModal(false)}
                onSend={handleSendEmail}
                isSending={isSendingEmail}
            />

            {/* QR Code Modal (2-Step for Offline Sharing) */}
            <QRCodeModal
                isOpen={showQRModal}
                onClose={() => setShowQRModal(false)}
                photoUrl={qrPhotoUrl}
                isGenerating={isGeneratingQR}
                wifiSsid={config.wifiSsid}
                wifiPassword={config.wifiPassword}
                isLocalMode={config.sharingMode === 'local'}
            />
        </motion.div>
    )
}

export default PostProcessing
