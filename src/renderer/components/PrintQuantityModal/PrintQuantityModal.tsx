import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './PrintQuantityModal.module.css'

interface PrintQuantityModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (quantity: number) => void
    initialQuantity?: number
}

export function PrintQuantityModal({ isOpen, onClose, onConfirm, initialQuantity = 2 }: PrintQuantityModalProps): JSX.Element | null {
    const [quantity, setQuantity] = useState(initialQuantity)

    if (!isOpen) return null

    const handleIncrement = () => {
        setQuantity(prev => prev + 2)
    }

    const handleDecrement = () => {
        setQuantity(prev => Math.max(2, prev - 2))
    }

    const handleConfirm = () => {
        console.log('[PrintQuantityModal] Confirm clicked with quantity:', quantity)
        onConfirm(quantity)
        onClose()
    }

    return (
        <AnimatePresence>
            <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className={styles.modal}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className={styles.closeBtn} onClick={onClose}>
                        ×
                    </button>

                    <h2 className={styles.title}>🖨️ Mau cetak berapa foto?</h2>
                    <p className={styles.subtitle}>
                        Kita pakai kelipatan 2 yaa
                    </p>

                    <div className={styles.quantitySelector}>
                        <button
                            className={styles.quantityBtn}
                            onClick={handleDecrement}
                            disabled={quantity <= 2}
                        >
                            −
                        </button>
                        <span className={styles.quantityDisplay}>{quantity}</span>
                        <button
                            className={styles.quantityBtn}
                            onClick={handleIncrement}
                        >
                            +
                        </button>
                    </div>

                    <div className={styles.actions}>
                        <button
                            className={styles.cancelBtn}
                            onClick={onClose}
                        >
                            Batal
                        </button>
                        <button
                            className={styles.confirmBtn}
                            onClick={handleConfirm}
                        >
                            Cetak {quantity} Foto
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}