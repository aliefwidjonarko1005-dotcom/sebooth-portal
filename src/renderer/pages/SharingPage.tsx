import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'
import { useSessionStore, useAppConfig } from '../stores'
import styles from './SharingPage.module.css'

function SharingPage(): JSX.Element {
    const navigate = useNavigate()
    const { currentSession, endSession } = useSessionStore()
    const { config } = useAppConfig()

    const [qrUrl, setQrUrl] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!currentSession) {
            navigate('/')
            return
        }

        generateQR()
    }, [currentSession, navigate])

    const generateQR = async () => {
        setIsGenerating(true)
        setError(null)
        try {
            // Check if we already have a gallery URL saved in the local storage for this session
            const cachedUrl = localStorage.getItem(`gallery_${currentSession!.id}`)
            if (cachedUrl) {
                setQrUrl(cachedUrl)
                setIsGenerating(false)
                return
            }

            // In local wifi mode, we expose the local server URL
            if (config.sharingMode === 'local') {
                const ipRes = await (window as any).api.system.getLocalIp()
                if (ipRes && ipRes.success && ipRes.data) {
                    const localIp = ipRes.data
                    const localUrl = `http://${localIp}:5050/gallery/${currentSession!.id}`
                    setQrUrl(localUrl)
                    
                    // Save to localStorage so it persists
                    localStorage.setItem(`gallery_${currentSession!.id}`, localUrl)
                } else {
                    throw new Error('Could not determine local IP')
                }
            } else {
                // For cloud mode, normally we'd trigger the upload here or point to the Sebooth Web App
                // Since user mentioned: "diarahkan ke website sebooth terpisah... ini nanti saja, saya akan sediakan server"
                // We'll create a dummy URL for now that represents the future Sebooth Web App.
                const dummyUrl = `https://sebooth.app/download/${currentSession!.id}`
                setQrUrl(dummyUrl)
                localStorage.setItem(`gallery_${currentSession!.id}`, dummyUrl)
            }
        } catch (err) {
            console.error('Failed to generate QR or get URL:', err)
            setError('Gagal membuat QR Code')
        } finally {
            setIsGenerating(false)
        }
    }

    const handlePrint = () => {
        // Navigate to the printing page which will handle the actual print command and animation
        navigate('/printing')
    }

    const handleHome = () => {
        endSession()
        navigate('/')
    }

    return (
        <div className={styles.container}>
            <motion.h1 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={styles.title}
            >
                Share Your Memories
            </motion.h1>
            
            <motion.p 
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={styles.subtitle}
            >
                Scan the QR code below using your phone camera to download your photos, GIF, and Live Video.
            </motion.p>

            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className={styles.qrContainer}
            >
                {isGenerating ? (
                    <div className={styles.loadingQr}>
                        <div className={styles.spinner}></div>
                        <p>Generating QR Code...</p>
                    </div>
                ) : error ? (
                    <div className={styles.loadingQr}>
                        <p style={{ color: 'red' }}>{error}</p>
                    </div>
                ) : qrUrl ? (
                    <>
                        <div className={styles.qrCode}>
                            <QRCode value={qrUrl} size={250} level="H" />
                        </div>
                        <p className={styles.scanText}>Aim your camera here</p>
                    </>
                ) : null}
            </motion.div>

            <div className={styles.bottomControls}>
                <motion.button 
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className={styles.homeButton}
                    onClick={handleHome}
                >
                    <img src="./assets/icons/icon-home.png" alt="Home" className={styles.btnIcon} />
                    Done (Home)
                </motion.button>
                
                <motion.button 
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className={styles.printButton}
                    onClick={handlePrint}
                >
                    <img src="./assets/icons/icon-printer.png" alt="Print" className={styles.btnIcon} />
                    Print Photos
                </motion.button>
            </div>
        </div>
    )
}

export default SharingPage
