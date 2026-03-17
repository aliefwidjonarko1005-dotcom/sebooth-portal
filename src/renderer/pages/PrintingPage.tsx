import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore, useAppConfig } from '../stores'
import styles from './PrintingPage.module.css'
// Note: You must place 'printing_animation.mov' (or .mp4) in the src/renderer/assets folder 
// or update this path to the correct asset later.
// We'll use a placeholder variable for now.
import PrintingAnimation from '../assets/printing_animation.mp4'

function PrintingPage(): JSX.Element {
    const navigate = useNavigate()
    const { currentSession, compositePath, endSession } = useSessionStore()
    const { config } = useAppConfig()
    
    const [error, setError] = useState<string | null>(null)
    const hasStartedPrinting = useRef(false)

    useEffect(() => {
        if (!currentSession || !compositePath) {
            navigate('/')
            return
        }

        // Prevent double printing in React Strict Mode
        if (!hasStartedPrinting.current) {
            hasStartedPrinting.current = true
            handlePrint()
        }
    }, [currentSession, compositePath, navigate])

    const handlePrint = async () => {
        setError(null)

        try {
            // Find strip in session folder
            let stripPath: string | null = null
            try {
                const findResult = await (window as any).api.system.findSessionStrip(currentSession!.id)
                if (findResult.success && findResult.data) {
                    stripPath = findResult.data
                }
            } catch { /* ignore, use fallback */ }

            // Fallback: use the base64 composite we have in state
            if (!stripPath && compositePath) {
                const saveResult = await (window as any).api.system.saveDataUrl(
                    compositePath,
                    `strip_${currentSession!.id}.jpg`
                )
                if (saveResult.success && saveResult.data) {
                    stripPath = saveResult.data
                }
            }

            if (stripPath) {
                // Hardcoded to 2 for standard photobooth
                const printQuantity = 2
                const copies = Math.max(1, Math.round(printQuantity / 2))
                
                // This promise resolves when the OS print spooler accepts the job
                const result = await (window as any).api.printer.printWithOptions(stripPath, {
                    printer: config.printerName || undefined,
                    copies
                })
                
                if (!result.success) {
                    setError(result.error || 'Print failed')
                    // If print fails, wait a bit so user can read the error, then go home
                    setTimeout(() => {
                        endSession()
                        navigate('/')
                    }, 5000)
                } else {
                    // Success! Go home
                    endSession()
                    navigate('/')
                }
            } else {
                setError('Failed to find or save strip for printing')
                setTimeout(() => {
                    endSession()
                    navigate('/')
                }, 5000)
            }
        } catch (err) {
            setError('Print failed: ' + (err as Error).message)
            setTimeout(() => {
                endSession()
                navigate('/')
            }, 5000)
        }
    }

    return (
        <div className={styles.container}>
            {/* 
                We use an HTML5 video tag. 
                autoPlay, loop, muted ensures it plays automatically in the background 
            */}
            <video 
                className={styles.videoBackground}
                autoPlay 
                loop 
                muted 
                playsInline
                // Fallback gracefully if asset is missing during dev
                onError={(e) => console.log('Video error:', e)}
            >
                <source src={PrintingAnimation} type="video/mp4" />
                {/* Add .mov support if needed */}
                {/* <source src={PrintingAnimationMov} type="video/quicktime" /> */}
            </video>

            <div className={styles.overlay}></div>

            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.content}>
                <h1 className={styles.title}>Printing Your Memories</h1>
                <p className={styles.subtitle}>Please wait a moment while your photos are being printed...</p>
                <div className={styles.loadingSpinner}></div>
            </div>
        </div>
    )
}

export default PrintingPage
