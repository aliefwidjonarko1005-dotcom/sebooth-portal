import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { useAppConfig } from './stores'
import Landing from './pages/Landing'
import AdminDashboard from './pages/AdminDashboard'
import FrameSelection from './pages/FrameSelection'
import PaymentGateway from './pages/PaymentGateway'
import CaptureSession from './pages/CaptureSession'
import PostProcessing from './pages/PostProcessing'
import GalleryPage from './pages/GalleryPage'

function App(): JSX.Element {
    const { config } = useAppConfig()

    useEffect(() => {
        const initCamera = async () => {
            try {
                const windowApi = (window as any).api;
                if (config.cameraMode === 'mock') {
                    await windowApi.camera.useMock()
                } else if (config.cameraMode === 'ptp') {
                    await windowApi.camera.useDirectPtp()
                } else if (config.cameraMode === 'dslr') {
                    await windowApi.camera.useReal()
                }
            } catch (err) {
                console.error('Failed to initialize camera mode on startup:', err)
            }
        }
        initCamera()
    }, [config.cameraMode])
    const toggleFullScreen = async () => {
        try {
            await (window as any).api.window.toggleFullscreen()
        } catch (error) {
            console.error('Failed to toggle fullscreen:', error)
        }
    }

    return (
        <>
            <AnimatePresence mode="wait">
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/frames" element={<FrameSelection />} />
                    <Route path="/payment" element={<PaymentGateway />} />
                    <Route path="/capture" element={<CaptureSession />} />
                    <Route path="/processing" element={<PostProcessing />} />
                    <Route path="/gallery" element={<GalleryPage />} />
                </Routes>
            </AnimatePresence>

            <button
                onClick={toggleFullScreen}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '20px',
                    zIndex: 9999,
                    background: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                }}
                title="Toggle Full Screen"
            >
                ⛶
            </button>
        </>
    )
}

export default App
