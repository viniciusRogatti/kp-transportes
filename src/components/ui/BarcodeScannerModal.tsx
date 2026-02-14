import { useEffect, useMemo, useRef } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  title?: string;
  helperText?: string;
  onClose: () => void;
  onBarcodeDetected: (value: string) => Promise<void> | void;
  onError?: (message: string) => void;
}

function BarcodeScannerModal({
  isOpen,
  title = 'Ler codigo de barras',
  helperText = 'Aponte a camera para o codigo de barras da NF e mantenha o codigo dentro da area destacada.',
  onClose,
  onBarcodeDetected,
  onError,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectionLockedRef = useRef(false);

  const possibleFormats = useMemo(() => ([
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
  ]), []);

  const stopScanner = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    detectionLockedRef.current = false;
  };

  useEffect(() => (
    () => {
      stopScanner();
    }
  ), []);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let cancelled = false;
    detectionLockedRef.current = false;

    const initializeScanner = async () => {
      if (!videoRef.current) {
        onError?.('Elemento de video indisponivel para leitura.');
        return;
      }

      if (!readerRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, possibleFormats);
        readerRef.current = new BrowserMultiFormatReader(hints);
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      };

      try {
        controlsRef.current = await readerRef.current.decodeFromConstraints(
          constraints,
          videoRef.current,
          async (result, error) => {
            if (cancelled || detectionLockedRef.current) return;

            if (result) {
              const scannedValue = String(result.getText() || '').trim();
              if (!scannedValue) return;

              detectionLockedRef.current = true;
              if (navigator.vibrate) navigator.vibrate(120);

              stopScanner();
              await onBarcodeDetected(scannedValue);
              return;
            }

            if (error && !(error instanceof NotFoundException)) {
              console.error(error);
              onError?.('Falha na leitura do codigo. Verifique permissao da camera e tente novamente.');
            }
          },
        );
      } catch (error) {
        console.error(error);
        onError?.('Nao foi possivel acessar a camera. Verifique permissao do navegador (HTTPS) e tente novamente.');
      }
    };

    const timer = window.setTimeout(() => {
      initializeScanner();
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, onBarcodeDetected, onError, possibleFormats]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 8, 20, 0.66)',
          zIndex: 1200,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 560px)',
          borderRadius: 14,
          border: '1px solid rgba(58, 164, 255, 0.32)',
          background: '#0a1629',
          boxShadow: '0 18px 44px rgba(0,0,0,0.46)',
          padding: '14px',
          zIndex: 1201,
        }}
      >
        <h3 style={{ color: '#e6edf8' }}>{title}</h3>
        <p style={{ marginTop: 8, color: '#9eb7ca', fontSize: 13 }}>{helperText}</p>

        <div style={{ position: 'relative', marginTop: 10 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid rgba(58, 164, 255, 0.35)',
              background: '#02060f',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '72%',
              height: '34%',
              border: '2px solid rgba(141, 217, 255, 0.95)',
              borderRadius: 10,
              boxShadow: '0 0 0 200vmax rgba(2, 8, 20, 0.18) inset',
            }}
          />
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={handleClose} type="button">
            Fechar camera
          </button>
        </div>
      </div>
    </>
  );
}

export default BarcodeScannerModal;
