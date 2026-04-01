import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, Flashlight, FlashlightOff, RotateCcw, ScanLine, Keyboard, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  continuous?: boolean;
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

interface CameraDevice {
  id: string;
  label: string;
}

export function BarcodeScanner({ 
  isOpen, 
  onClose, 
  onScan, 
  title,
  continuous = true 
}: BarcodeScannerProps) {
  const { t, dir, isRtl } = useLanguage();
  const resolvedTitle = title || t.scanner.title;
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isOcrMode, setIsOcrMode] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedRef = useRef<string | null>(null);
  const ocrProcessingRef = useRef(false);
  const isScanningRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onScanRef = useLatestRef(onScan);
  const onCloseRef = useLatestRef(onClose);

  const playBeep = useCallback((success: boolean = true) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = success ? 1200 : 400;
      oscillator.type = "sine";
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + (success ? 0.1 : 0.3));
      
      if (success) {
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 1600;
          osc2.type = "sine";
          gain2.gain.value = 0.3;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.1);
        }, 100);
      }
    } catch (e) {
      console.log("Audio not supported");
    }
  }, []);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  const extractNumbers = (text: string): string | null => {
    const cleaned = text.replace(/[^0-9]/g, "");
    // Only accept exactly 4 digits (0000-9999)
    if (cleaned.length === 4) {
      return cleaned;
    }
    // If we have more than 4 digits, try to find a 4-digit sequence
    if (cleaned.length > 4) {
      // Return the last 4 digits
      return cleaned.slice(-4);
    }
    // If less than 4 digits, pad with leading zeros
    if (cleaned.length > 0 && cleaned.length < 4) {
      return cleaned.padStart(4, '0');
    }
    return null;
  };

  const emitScan = useCallback((code: string, source: "barcode" | "ocr") => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 500) return;
    lastScanTimeRef.current = now;

    if (code === lastScannedRef.current) {
      setScanStatus(`${t.scanner.found} ${code} ✓`);
      playBeep(true);
      vibrate([50, 50, 50]);
    } else {
      setScanStatus(`${t.scanner.found} ${code} (${source === "ocr" ? "OCR" : t.scanner.switchToBarcode})`);
      playBeep(true);
      vibrate(50);
      lastScannedRef.current = code;
    }

    onScanRef.current(code);

    if (!continuous) {
      stopScannerInternal();
      onCloseRef.current();
    }
  }, [continuous, playBeep, vibrate]);

  const emitScanRef = useLatestRef(emitScan);

  const handleManualSubmit = useCallback(() => {
    const cleaned = manualCode.replace(/[^0-9]/g, "");
    if (cleaned.length > 0) {
      const code = cleaned.padStart(4, '0').slice(-4);
      emitScanRef.current(code, "barcode");
      setManualCode("");
      setShowManualInput(false);
    }
  }, [manualCode]);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const code = extractNumbers(decodedText);
    if (!code) return;
    emitScanRef.current(code, "barcode");
  }, []);

  const captureAndOcr = useCallback(async () => {
    if (ocrProcessingRef.current) return;

    ocrProcessingRef.current = true;
    setOcrProcessing(true);
    setScanStatus(t.scanner.analyzing);

    try {
      const videoElement = document.querySelector("#barcode-reader video") as HTMLVideoElement 
        || document.querySelector("video") as HTMLVideoElement;
      if (!videoElement) {
        setScanStatus(t.scanner.captureFailed);
        return;
      }

      const canvas = document.createElement("canvas");
      const maxSize = 800;
      let width = videoElement.videoWidth;
      let height = videoElement.videoHeight;
      if (width > height && width > maxSize) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width / height) * maxSize;
        height = maxSize;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(videoElement, 0, 0, width, height);
      const imageData = canvas.toDataURL("image/jpeg", 0.85);

      const ocrResponse = await fetch("/api/ocr/read-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imageData }),
        credentials: "include",
      });

      const result = await ocrResponse.json();

      if (result.success && result.code) {
        lastScannedRef.current = result.code;

        const productResponse = await fetch(`/api/products/by-suffix/${result.code}?_t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const products = productResponse.ok ? await productResponse.json() : [];

        if (products.length === 1) {
          const product = products[0];
          setScanStatus(`✓ ${product.name}`);
          playBeep(true);
          vibrate(50);
          window.dispatchEvent(new CustomEvent("pos-ocr-add-product", { detail: { product } }));
        } else if (products.length > 1) {
          setScanStatus(`${products.length} ${t.scanner.productsFound}`);
          playBeep(true);
          vibrate(50);
          window.dispatchEvent(new CustomEvent("pos-ocr-multi-products", { detail: { products, code: result.code } }));
        } else {
          setScanStatus(`${result.code} - ${t.scanner.notFound}`);
          playBeep(false);
          window.dispatchEvent(new CustomEvent("pos-ocr-not-found", { detail: { code: result.code } }));
        }

        if (!continuous) {
          setTimeout(() => onCloseRef.current(), 800);
        }
      } else {
        setScanStatus(result.error || t.scanner.noNumbersFound);
        playBeep(false);
      }
    } catch (e) {
      console.error("OCR error:", e);
      setScanStatus(t.scanner.ocrError);
      playBeep(false);
    } finally {
      ocrProcessingRef.current = false;
      setOcrProcessing(false);
    }
  }, [continuous, playBeep, vibrate]);

  const stopScannerInternal = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.log("Error stopping scanner:", e);
      }
      scannerRef.current = null;
    }
    isScanningRef.current = false;
    setIsScanning(false);
    setTorchOn(false);
    lastScannedRef.current = null;
    setScanStatus("");
  }, []);

  const startScanner = useCallback(async (cameraId?: string) => {
    try {
      setError(null);
      setScanStatus(t.scanner.scanning);
      
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {}
      }
      
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      const availableCameras = await Html5Qrcode.getCameras();
      if (availableCameras.length === 0) {
        throw new Error(t.scanner.noCameraFound);
      }
      
      setCameras(availableCameras);
      
      let selectedCamera: CameraDevice;
      if (cameraId) {
        selectedCamera = availableCameras.find(c => c.id === cameraId) || availableCameras[0];
      } else {
        const backCamera = availableCameras.find(c => 
          c.label.toLowerCase().includes("back") || 
          c.label.toLowerCase().includes("rear") ||
          c.label.toLowerCase().includes("environment")
        );
        selectedCamera = backCamera || availableCameras[availableCameras.length - 1];
        const idx = availableCameras.findIndex(c => c.id === selectedCamera.id);
        setCurrentCameraIndex(idx >= 0 ? idx : 0);
      }

      await scanner.start(
        selectedCamera.id,
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.777,
        },
        (decodedText: string) => {
          const code = extractNumbers(decodedText);
          if (!code) return;
          emitScanRef.current(code, "barcode");
        },
        () => {}
      );

      isScanningRef.current = true;
      setIsScanning(true);
      setScanStatus(t.scanner.productSearch);
    } catch (err: any) {
      console.error("Scanner error:", err);
      setError(err.message || t.common.error);
      setScanStatus("");
    }
  }, []);

  const stopScanner = stopScannerInternal;

  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    
    await stopScannerInternal();
    setTimeout(() => {
      startScanner(cameras[nextIndex].id);
    }, 100);
  }, [cameras, currentCameraIndex, startScanner, stopScannerInternal]);

  const toggleTorch = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      try {
        const videoTrack = (scannerRef.current as any).getRunningTrackCameraCapabilities?.();
        if (videoTrack?.torchFeature?.isSupported()) {
          await videoTrack.torchFeature.apply(!torchOn);
          setTorchOn(!torchOn);
        } else {
          const videoElement = document.querySelector("#barcode-reader video") as HTMLVideoElement;
          if (videoElement?.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            if (track) {
              const capabilities = track.getCapabilities() as any;
              if (capabilities?.torch) {
                await track.applyConstraints({
                  advanced: [{ torch: !torchOn } as any]
                });
                setTorchOn(!torchOn);
              }
            }
          }
        }
      } catch (e) {
        console.log("Torch not supported:", e);
      }
    }
  }, [isScanning, torchOn]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopScanner();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-black">
        <DialogHeader className="p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-lg">{resolvedTitle}</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="text-white hover:bg-white/20"
              data-testid="button-close-scanner"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative w-full aspect-[4/3] bg-black">
          <div id="barcode-reader" className="w-full h-full" />
          
          {!isScanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 animate-pulse" />
                <p>{t.scanner.scanning}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center p-6">
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={() => startScanner()} variant="outline" className="text-white border-white">
                  {t.common.reset}
                </Button>
              </div>
            </div>
          )}

          {isScanning && (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-36 border-2 border-primary rounded-lg relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />
                </div>
              </div>

              <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-3 z-10">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleTorch}
                  className={`h-12 w-12 rounded-full border-white/30 text-white hover:bg-white/30 ${torchOn ? 'bg-yellow-500/50' : 'bg-white/20'}`}
                  data-testid="button-toggle-torch"
                  title={t.scanner.flash}
                >
                  {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                </Button>
                
                {cameras.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={switchCamera}
                    className="h-12 w-12 rounded-full bg-white/20 border-white/30 text-white hover:bg-white/30"
                    data-testid="button-switch-camera"
                    title={t.scanner.switchCamera}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={captureAndOcr}
                  disabled={ocrProcessing}
                  className={`h-12 w-12 rounded-full border-white/30 text-white hover:bg-white/30 ${ocrProcessing ? 'bg-blue-500/50 animate-pulse' : 'bg-white/20'}`}
                  data-testid="button-ocr-capture"
                  title={t.scanner.aiScan}
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className={`h-12 w-12 rounded-full border-white/30 text-white hover:bg-white/30 ${showManualInput ? 'bg-green-500/50' : 'bg-white/20'}`}
                  data-testid="button-manual-input"
                  title={t.scanner.manualInput}
                >
                  <Keyboard className="h-5 w-5" />
                </Button>
              </div>
              
              {showManualInput && (
                <div className="absolute bottom-36 left-4 right-4 z-20">
                  <div className="bg-black/90 backdrop-blur-sm rounded-lg p-3 flex gap-2">
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={t.scanner.enterSku}
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50 text-center text-lg font-mono"
                      maxLength={4}
                      data-testid="input-manual-code"
                      onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                    />
                    <Button
                      onClick={handleManualSubmit}
                      disabled={manualCode.length === 0}
                      className="bg-primary hover:bg-primary/80"
                      data-testid="button-submit-manual"
                    >
                      {t.common.add}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-gradient-to-t from-black to-transparent absolute bottom-0 left-0 right-0 z-10">
          <p className="text-white/80 text-center text-sm">
            {scanStatus || t.scanner.productSearch}
          </p>
          {continuous && scanStatus && (
            <p className="text-primary text-center text-xs mt-1">
              {lastScannedRef.current}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BarcodeScanButton({ 
  onScan, 
  className = "",
  continuous = true,
  title
}: { 
  onScan: (code: string) => void;
  className?: string;
  continuous?: boolean;
  title?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className={className}
        data-testid="button-open-scanner"
      >
        <Camera className="h-5 w-5" />
      </Button>
      <BarcodeScanner
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onScan={onScan}
        continuous={continuous}
        title={title}
      />
    </>
  );
}
