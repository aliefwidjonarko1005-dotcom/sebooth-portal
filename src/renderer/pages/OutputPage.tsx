import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFrameStore, useSessionStore, useFilterStore, useAppConfig } from '../stores'
import styles from './OutputPage.module.css'

function OutputPage(): JSX.Element {
    const navigate = useNavigate()
    const { frames, activeFrame } = useFrameStore()
    const { photos, currentSession, setCompositePath, selectedFilter } = useSessionStore()
    const { config } = useAppConfig()

    const sessionFrame = currentSession?.frameId
        ? frames.find(f => f.id === currentSession.frameId)
        : activeFrame

    const [activeMedia, setActiveMedia] = useState<'strip' | 'gif' | 'live' | null>(null)
    const [viewedMedia, setViewedMedia] = useState<{ strip: boolean; gif: boolean; live: boolean }>({
        strip: false,
        gif: false,
        live: false
    })
    const [gifDataUrl, setGifDataUrl] = useState<string | null>(null)
    const [liveVideoPath, setLiveVideoPath] = useState<string | null>(null)
    const [compositeDataUrl, setCompositeDataUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(true)

    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Track viewed media
    useEffect(() => {
        if (activeMedia) {
            setViewedMedia(prev => ({ ...prev, [activeMedia]: true }))
        }
    }, [activeMedia])

    // Generate composite when photos, frame, or filter changes
    useEffect(() => {
        if (photos.length > 0 && sessionFrame) {
            generateMedia()
        }
    }, [photos, sessionFrame, selectedFilter])

    const generateMedia = async () => {
        setIsProcessing(true)
        try {
            await generateCompositeFromPhotos()
            await generateGif()
            extractLiveVideo()
        } finally {
            setIsProcessing(false)
        }
    }

    const extractLiveVideo = () => {
        // Find the first available pre-captured video in the session
        const videoPhoto = photos.find(p => p.videoPath && !p.videoPath.startsWith('blob:'))
        if (videoPhoto && videoPhoto.videoPath) {
            setLiveVideoPath(`file://${videoPhoto.videoPath.replace(/\\/g, '/')}`)
        }
    }

    const generateGif = async () => {
        if (photos.length === 0 || !sessionFrame) return
        const gifCanvas = document.createElement('canvas')
        const firstSlot = sessionFrame.slots?.[0]
        const slotAspect = firstSlot ? (firstSlot.width / firstSlot.height) : 1.5
        gifCanvas.width = 1080
        gifCanvas.height = Math.round(1080 / slotAspect)
        const gctx = gifCanvas.getContext('2d', { willReadFrequently: true, alpha: false })
        if (!gctx) return

        gctx.imageSmoothingEnabled = true
        gctx.imageSmoothingQuality = 'high'
        const framesBase64: string[] = []

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
            for (const photo of photos) {
                const img = await loadImage(photo.imagePath)
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
            if ((window as any).api.system.generateHqGif) {
                const hqGifResult = await (window as any).api.system.generateHqGif(framesBase64, 500)
                if (hqGifResult.success && hqGifResult.data) {
                    setGifDataUrl(hqGifResult.data)
                }
            }
        } catch (e) {
            console.error('GIF Gen Error', e)
        }
    }

    // Generate composite from photos using canvas
    const generateCompositeFromPhotos = async (): Promise<void> => {
        if (!sessionFrame || photos.length === 0 || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = sessionFrame.canvasWidth
        canvas.height = sessionFrame.canvasHeight

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
            let filterStr = 'none';
            if (selectedFilter === 'grayscale') filterStr = 'grayscale(100%)'
            else if (selectedFilter === 'sepia') filterStr = 'sepia(80%)'
            else if (selectedFilter === 'warm') filterStr = 'saturate(1.3) hue-rotate(-10deg)'
            else if (selectedFilter === 'cool') filterStr = 'saturate(1.1) hue-rotate(10deg)'
            else if (selectedFilter === 'vintage') filterStr = 'contrast(1.1) brightness(0.9) sepia(30%)'
            
            ctx.filter = filterStr;

            for (const slot of sessionFrame.slots) {
                const sourceSlotId = slot.duplicateOfSlotId || slot.id
                const photo = photos.find(p => p.slotId === sourceSlotId)
                if (!photo) continue

                try {
                    const img = await loadImage(photo.imagePath)

                    ctx.save()
                    ctx.translate(slot.x + slot.width / 2, slot.y + slot.height / 2)
                    ctx.rotate((slot.rotation * Math.PI) / 180)

                    ctx.beginPath()
                    ctx.rect(-slot.width / 2, -slot.height / 2, slot.width, slot.height)
                    ctx.clip()

                    const imgAspect = img.width / img.height
                    const slotAspect = slot.width / slot.height
                    let drawWidth, drawHeight

                    if (imgAspect > slotAspect) {
                        drawHeight = slot.height
                        drawWidth = slot.height * imgAspect
                    } else {
                        drawWidth = slot.width
                        drawHeight = slot.width / imgAspect
                    }

                    const scale = photo.scale || 1
                    const panX = photo.panX || 0
                    const panY = photo.panY || 0

                    ctx.translate(panX, panY)
                    ctx.scale(scale, scale)

                    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
                    ctx.restore()
                } catch (err) {
                    console.error('Failed to load photo:', err)
                }
            }

            try {
                ctx.filter = 'none'

                const frameImg = await loadImage(`file://${sessionFrame.overlayPath}`)
                const frameAspect = frameImg.width / frameImg.height
                const canvasAspect = canvas.width / canvas.height

                let fw = canvas.width
                let fh = canvas.height
                let fx = 0
                let fy = 0

                if (Math.abs(frameAspect - canvasAspect) > 0.01) {
                    if (frameAspect > canvasAspect) {
                        fw = canvas.width
                        fh = canvas.width / frameAspect
                        fy = (canvas.height - fh) / 2
                    } else {
                        fh = canvas.height
                        fw = canvas.height * frameAspect
                        fx = (canvas.width - fw) / 2
                    }
                }

                ctx.drawImage(frameImg, fx, fy, fw, fh)

            } catch (err) {
                console.error('Failed to load frame overlay:', err)
            }

            const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
            setCompositeDataUrl(dataUrl)
            setCompositePath(dataUrl)

        } catch (error) {
            console.error('Failed to generate composite:', error)
            setError('Failed to generate composite image')
        }
    }


    const renderShowcase = () => {
        if (!activeMedia) return null
        if (!sessionFrame && activeMedia === 'live') return null

        let content = null
        let title = ''

        if (activeMedia === 'strip') {
            title = 'Photo Strip'
            content = compositeDataUrl ? <img src={compositeDataUrl} alt="Strip" className={styles.showcaseMedia} /> : <p>Loading...</p>
        } else if (activeMedia === 'gif') {
            title = 'GIF Animation'
            content = gifDataUrl ? <img src={gifDataUrl} alt="GIF" className={styles.showcaseMedia} /> : (
                // Fallback grid if GIF fails or is generating
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center'}}>
                    {photos.map((p, i) => (
                        <img key={i} src={p.imagePath} alt={`Frame ${i}`} style={{height: '250px', borderRadius: '8px'}} />
                    ))}
                </div>
            )
        } else if (activeMedia === 'live' && sessionFrame) {
            title = 'Live Photo'
            
            const scaleY = (window.innerHeight * 0.8) / sessionFrame.canvasHeight
            const scaleX = (window.innerWidth * 0.8) / sessionFrame.canvasWidth
            const scale = Math.min(scaleX, scaleY, 1)

            let filterStyle = {}
            if (selectedFilter === 'grayscale') filterStyle = { filter: 'grayscale(100%)' }
            else if (selectedFilter === 'sepia') filterStyle = { filter: 'sepia(80%)' }
            else if (selectedFilter === 'warm') filterStyle = { filter: 'saturate(1.3) hue-rotate(-10deg)' }
            else if (selectedFilter === 'cool') filterStyle = { filter: 'saturate(1.1) hue-rotate(10deg)' }
            else if (selectedFilter === 'vintage') filterStyle = { filter: 'contrast(1.1) brightness(0.9) sepia(30%)' }

            content = (
                <div style={{
                    position: 'relative',
                    width: sessionFrame.canvasWidth * scale,
                    height: sessionFrame.canvasHeight * scale,
                    boxShadow: '0 0 50px rgba(0,0,0,0.8)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: 'white',
                    flexShrink: 0
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: sessionFrame.canvasWidth,
                        height: sessionFrame.canvasHeight,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left'
                    }}>
                        {sessionFrame.slots.map(slot => {
                            const sourceSlotId = slot.duplicateOfSlotId || slot.id
                            const photo = photos.find(p => p.slotId === sourceSlotId)
                            if (!photo) return null
                            
                            // Use video if available, fallback to image if not
                            const isVideo = !!photo.videoPath
                            let src = photo.imagePath
                            if (isVideo) {
                                if (photo.videoPath!.startsWith('blob:') || photo.videoPath!.startsWith('file://')) {
                                    src = photo.videoPath!
                                } else {
                                    src = `file:///${photo.videoPath!.replace(/\\/g, '/')}`
                                }
                            }
                            
                            const mediaStyle: React.CSSProperties = {
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: `translate(${photo.panX || 0}px, ${photo.panY || 0}px) scale(${photo.scale || 1})`,
                                transformOrigin: 'center center',
                                ...filterStyle
                            }

                            return (
                                <div key={slot.id} style={{
                                    position: 'absolute',
                                    left: slot.x,
                                    top: slot.y,
                                    width: slot.width,
                                    height: slot.height,
                                    transform: `rotate(${slot.rotation}deg)`,
                                    overflow: 'hidden'
                                }}>
                                    {isVideo ? (
                                        <video src={src} autoPlay loop muted playsInline style={mediaStyle} />
                                    ) : (
                                        <img src={src} style={mediaStyle} />
                                    )}
                                </div>
                            )
                        })}
                        <img 
                            src={`file:///${sessionFrame.overlayPath.replace(/\\/g, '/')}`} 
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none'
                            }} 
                            alt="Frame Overlay" 
                        />
                    </div>
                </div>
            )
        }

        return (
            <motion.div 
                className={styles.showcaseContainer}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
            >
                <div className={styles.showcaseHeader}>
                    <h2 className={styles.showcaseTitle}>{title}</h2>
                    <button className={styles.closeButton} onClick={() => setActiveMedia(null)}>✕</button>
                </div>
                <div className={styles.mediaWrapper}>
                    {content}
                </div>
            </motion.div>
        )
    }

    const allViewed = viewedMedia.strip && viewedMedia.gif && viewedMedia.live

    return (
        <div className={styles.container}>
            {error && <div className={styles.errorMessage}>{error}</div>}

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <AnimatePresence>
                {isProcessing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={styles.loadingOverlay}
                    >
                        <div className={styles.spinner}></div>
                        <p>Processing Magic...</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3 Interactive Buttons */}
            <AnimatePresence mode="wait">
                {!isProcessing && !activeMedia && (
                    <motion.div
                        key="buttons-grid"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.1 }}
                        className={styles.buttonsContainer}
                    >
                        <div className={`${styles.mediaButton} ${viewedMedia.strip ? styles.viewed : ''}`} onClick={() => setActiveMedia('strip')}>
                            {viewedMedia.strip && <div className={styles.viewedCheck}>✓</div>}
                            <div className={styles.buttonIcon}>
                                <img src="./assets/icons/icon-photo-strip.png" alt="Photo Strip" />
                            </div>
                            <div className={styles.buttonText}>Photo Strip</div>
                        </div>
                        <div className={`${styles.mediaButton} ${viewedMedia.gif ? styles.viewed : ''}`} onClick={() => setActiveMedia('gif')}>
                            {viewedMedia.gif && <div className={styles.viewedCheck}>✓</div>}
                            <div className={styles.buttonIcon}>
                                <img src="./assets/icons/icon-gif.png" alt="GIF" />
                            </div>
                            <div className={styles.buttonText}>GIF</div>
                        </div>
                        <div className={`${styles.mediaButton} ${viewedMedia.live ? styles.viewed : ''}`} onClick={() => setActiveMedia('live')}>
                            {viewedMedia.live && <div className={styles.viewedCheck}>✓</div>}
                            <div className={styles.buttonIcon}>
                                <img src="./assets/icons/icon-live-photo.png" alt="Live Photo" />
                            </div>
                            <div className={styles.buttonText}>Live Photo</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Showcase Overlay */}
            <AnimatePresence>
                {renderShowcase()}
            </AnimatePresence>

            {/* Next Button only visible when all media reviewed */}
            <AnimatePresence>
                {!isProcessing && allViewed && !activeMedia && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={styles.nextButton}
                        onClick={() => navigate('/sharing')}
                    >
                        Lanjutkan <span>→</span>
                    </motion.button>
                )}
            </AnimatePresence>

        </div>
    )
}

export default OutputPage
