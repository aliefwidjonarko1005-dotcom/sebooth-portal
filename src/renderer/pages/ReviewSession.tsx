import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSessionStore, useFrameStore } from '../stores'
import styles from './ReviewSession.module.css'

type FilterType = 'none' | 'grayscale' | 'sepia' | 'warm' | 'cool' | 'vintage'

const FILTERS: { id: FilterType; name: string; style: React.CSSProperties; filterStr: string }[] = [
    { id: 'none', name: 'Original', style: {}, filterStr: 'none' },
    { id: 'grayscale', name: 'B&W', style: { filter: 'grayscale(100%)' }, filterStr: 'grayscale(100%)' },
    { id: 'sepia', name: 'Sepia', style: { filter: 'sepia(80%)' }, filterStr: 'sepia(80%)' },
    { id: 'warm', name: 'Warm', style: { filter: 'saturate(1.3) hue-rotate(-10deg)' }, filterStr: 'saturate(1.3) hue-rotate(-10deg)' },
    { id: 'cool', name: 'Cool', style: { filter: 'saturate(1.1) hue-rotate(10deg)' }, filterStr: 'saturate(1.1) hue-rotate(10deg)' },
    { id: 'vintage', name: 'Vintage', style: { filter: 'contrast(1.1) brightness(0.9) sepia(30%)' }, filterStr: 'contrast(1.1) brightness(0.9) sepia(30%)' }
]

const ReviewSession: React.FC = () => {
    const navigate = useNavigate()
    const { 
        currentSession, 
        photos, 
        updatePhoto, 
        swapPhotos, 
        removePhoto,
        selectedFilter,
        setSessionFilter
    } = useSessionStore()
    const { frames } = useFrameStore()
    
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
    const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({})
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!currentSession || photos.length === 0) {
            navigate('/capture')
        }
    }, [currentSession, photos, navigate])

    if (!currentSession) return null

    const sessionFrame = frames.find(f => f.id === currentSession.frameId)
    if (!sessionFrame) return null

    const getScale = () => {
        if (!containerRef.current) return 1
        // Allow room for absolute Header (top) and Tools Panel (bottom)
        const padding = 280
        const availableHeight = containerRef.current.clientHeight - padding
        return availableHeight / sessionFrame.canvasHeight
    }

    const handleWheel = (e: React.WheelEvent, slotId: string) => {
        if (selectedSlotId !== slotId) return
        
        const selectedSlot = sessionFrame.slots.find(s => s.id === slotId)
        const sourceSlotId = selectedSlot?.duplicateOfSlotId || slotId
        const photo = photos.find(p => p.slotId === sourceSlotId)
        if (!photo) return
        
        const currentScale = photo.scale || 1
        const zoomSensitivity = 0.05
        
        let newScale = currentScale + (e.deltaY < 0 ? zoomSensitivity : -zoomSensitivity)
        newScale = Math.max(0.5, Math.min(newScale, 5))
        
        updatePhoto(sourceSlotId, { scale: newScale })
    }

    const handleDragEnd = (event: any, info: any, physicalSlotId: string) => {
        const sourceA = sessionFrame.slots.find(s => s.id === physicalSlotId)?.duplicateOfSlotId || physicalSlotId;
        
        // Find if we dragged it over a different slot
        const droppedElements = document.elementsFromPoint(info.point.x, info.point.y);
        const targetSlotEl = droppedElements.find(el => el.hasAttribute('data-slot-id'));
        const targetSlotId = targetSlotEl ? targetSlotEl.getAttribute('data-slot-id') : null;

        if (targetSlotId && targetSlotId !== physicalSlotId) {
            const sourceB = sessionFrame.slots.find(s => s.id === targetSlotId)?.duplicateOfSlotId || targetSlotId;
            
            if (sourceA !== sourceB) {
                swapPhotos(sourceA, sourceB);
            }
            setSelectedSlotId(targetSlotId);
            return;
        }

        // Just regular pan
        const photo = photos.find(p => p.slotId === sourceA);
        if (!photo) return;
        
        const viewScale = getScale()
        const dx = info.offset.x / viewScale
        const dy = info.offset.y / viewScale

        let newPanX = (photo.panX || 0) + dx;
        let newPanY = (photo.panY || 0) + dy;

        // Calculate softer clamp boundaries
        const slot = sessionFrame.slots.find(s => s.id === physicalSlotId);
        if (slot) {
            const imgAspect = aspectRatios[physicalSlotId] || 1.5;
            const slotAspect = slot.width / slot.height;
            let drawWidth, drawHeight;
            if (imgAspect > slotAspect) {
                drawHeight = slot.height;
                drawWidth = slot.height * imgAspect;
            } else {
                drawWidth = slot.width;
                drawHeight = slot.width / imgAspect;
            }
            const scale = photo.scale || 1;
            
            // Allow panning until edge is reached, plus a soft margin so it doesn't disappear
            const maxPanX = Math.max(0, (drawWidth * scale - slot.width) / 2);
            const maxPanY = Math.max(0, (drawHeight * scale - slot.height) / 2);
            
            // Add a soft margin (40% of the slot size) so it doesn't just disappear completely in case of drastic scale changes
            const softMarginX = slot.width * 0.4;
            const softMarginY = slot.height * 0.4;

            newPanX = Math.max(-maxPanX - softMarginX, Math.min(newPanX, maxPanX + softMarginX));
            newPanY = Math.max(-maxPanY - softMarginY, Math.min(newPanY, maxPanY + softMarginY));
        }

        updatePhoto(sourceA, {
            panX: newPanX,
            panY: newPanY
        });
    }

    const handleZoomIn = () => {
        if (!selectedSlotId) return
        const selectedSlot = sessionFrame.slots.find(s => s.id === selectedSlotId)
        const sourceSlotId = selectedSlot?.duplicateOfSlotId || selectedSlotId
        const photo = photos.find(p => p.slotId === sourceSlotId)
        if (!photo) return
        const newScale = Math.min((photo.scale || 1) + 0.1, 5)
        updatePhoto(sourceSlotId, { scale: newScale })
    }

    const handleZoomOut = () => {
        if (!selectedSlotId) return
        const selectedSlot = sessionFrame.slots.find(s => s.id === selectedSlotId)
        const sourceSlotId = selectedSlot?.duplicateOfSlotId || selectedSlotId
        const photo = photos.find(p => p.slotId === sourceSlotId)
        if (!photo) return
        const newScale = Math.max((photo.scale || 1) - 0.1, 0.5)
        updatePhoto(sourceSlotId, { scale: newScale })
    }

    const handleRetake = () => {
        if (!selectedSlotId) return
        const selectedSlot = sessionFrame.slots.find(s => s.id === selectedSlotId)
        const sourceSlotId = selectedSlot?.duplicateOfSlotId || selectedSlotId
        removePhoto(sourceSlotId)
        navigate('/capture')
    }

    // Auto select first slot
    useEffect(() => {
        if (!selectedSlotId && sessionFrame.slots.length > 0) {
            const firstFilledSlot = sessionFrame.slots.find(slot => {
                const sourceSlotId = slot.duplicateOfSlotId || slot.id
                return photos.some(p => p.slotId === sourceSlotId)
            })
            setSelectedSlotId(firstFilledSlot?.id || sessionFrame.slots[0].id)
        }
    }, [selectedSlotId, sessionFrame, photos])

    // Retrieve current filter style
    const currentFilterDef = FILTERS.find(f => f.id === selectedFilter);
    const filterStyle = currentFilterDef ? currentFilterDef.style : {};

    const selectedPhoto = selectedSlotId 
        ? (() => {
            const selectedSlot = sessionFrame.slots.find(s => s.id === selectedSlotId)
            const sourceSlotId = selectedSlot?.duplicateOfSlotId || selectedSlotId
            return photos.find(p => p.slotId === sourceSlotId)
        })()
        : (() => {
            const firstFilledSlot = sessionFrame.slots.find(slot => {
                const sourceSlotId = slot.duplicateOfSlotId || slot.id
                return photos.some(p => p.slotId === sourceSlotId)
            })
            const sourceSlotId = firstFilledSlot?.duplicateOfSlotId || firstFilledSlot?.id
            return sourceSlotId ? photos.find(p => p.slotId === sourceSlotId) : photos[0]
        })()

    return (
        <motion.div 
            className={styles.container}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className={styles.header}>
                <h2>Review & Filter</h2>
                <p>Drag to move or swap photos. Scroll to zoom. Pick a filter before continuing.</p>
            </div>

            <div className={styles.workspace} ref={containerRef}>
                <div 
                    className={styles.canvasContainer}
                    style={{
                        width: sessionFrame.canvasWidth,
                        height: sessionFrame.canvasHeight,
                        transform: `scale(${getScale()})`,
                        transformOrigin: 'center center'
                    }}
                >
                    {sessionFrame.slots.map(slot => {
                        const sourceSlotId = slot.duplicateOfSlotId || slot.id
                        const photo = photos.find(p => p.slotId === sourceSlotId)
                        if (!photo) return null
                        
                        const isSelected = selectedSlotId === slot.id
                        const imgAspect = aspectRatios[slot.id] || 1.5; // defaults
                        const slotAspect = slot.width / slot.height;

                        let drawWidth, drawHeight;
                        if (imgAspect > slotAspect) {
                            drawHeight = slot.height;
                            drawWidth = slot.height * imgAspect;
                        } else {
                            drawWidth = slot.width;
                            drawHeight = slot.width / imgAspect;
                        }

                        // Use the physical slot id plus the photo path so duplicate slots keep unique keys.
                        const motionKey = `${slot.id}-${photo.imagePath}`;

                        return (
                            <div 
                                key={slot.id}
                                className={`${styles.slotWrapper} ${isSelected ? styles.selected : ''}`}
                                style={{
                                    left: slot.x,
                                    top: slot.y,
                                    width: slot.width,
                                    height: slot.height,
                                    transform: `rotate(${slot.rotation}deg)`
                                }}
                                data-slot-id={slot.id} // crucial for target identification
                                onPointerDown={() => setSelectedSlotId(slot.id)}
                                onWheel={(e) => handleWheel(e, slot.id)}
                            >
                                <motion.img 
                                    key={motionKey}
                                    src={photo.imagePath} 
                                    className={styles.photoImage}
                                    draggable={false}
                                    onLoad={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        setAspectRatios(prev => ({ 
                                            ...prev, 
                                            [slot.id]: target.naturalWidth / target.naturalHeight 
                                        }))
                                    }}
                                    style={{
                                        width: drawWidth,
                                        height: drawHeight,
                                        left: (slot.width - drawWidth) / 2,
                                        top: (slot.height - drawHeight) / 2,
                                        scale: photo.scale || 1,
                                        ...filterStyle
                                    }}
                                    initial={{ x: photo.panX || 0, y: photo.panY || 0 }}
                                    drag
                                    dragMomentum={false}
                                    onDragEnd={(e, info) => handleDragEnd(e, info, slot.id)}
                                    // ensure clicking makes it selected
                                    onDragStart={() => setSelectedSlotId(slot.id)}
                                />
                            </div>
                        )
                    })}

                    <img 
                        src={`file:///${sessionFrame.overlayPath.replace(/\\/g, '/')}`} 
                        className={styles.frameOverlay} 
                        alt="Frame Override" 
                    />
                </div>
            </div>

            <div className={styles.toolsPanel}>
                <div className={styles.toolGroup}>
                    <button 
                        className={styles.toolButton} 
                        onClick={handleZoomOut}
                        disabled={!selectedSlotId}
                        title="Zoom Out"
                    >
                        -
                    </button>
                    <button 
                        className={styles.toolButton} 
                        onClick={handleZoomIn}
                        disabled={!selectedSlotId}
                        title="Zoom In"
                    >
                        +
                    </button>
                </div>
                
                <div className={styles.toolGroup}>
                    <button 
                        className={styles.retakeBtn}
                        disabled={!selectedSlotId}
                        onClick={handleRetake}
                    >
                        📸 Retake Selected
                    </button>
                </div>

                <div className={styles.filterTabs}>
                    {FILTERS.map(filter => (
                        <button
                            key={filter.id}
                            className={`${styles.filterBtn} ${selectedFilter === filter.id ? styles.active : ''}`}
                            onClick={() => setSessionFilter(filter.id)}
                        >
                            <div className={styles.filterPreview} style={filter.style}>
                                {selectedPhoto && <img src={selectedPhoto.imagePath} alt={filter.name} />}
                            </div>
                            <span>{filter.name}</span>
                        </button>
                    ))}
                </div>

                <button className={styles.nextBtn} onClick={() => navigate('/output')}>
                    Next Step ➔
                </button>
            </div>
        </motion.div>
    )
}


export default ReviewSession
