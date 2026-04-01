import { useState, useCallback, useRef, useEffect } from "react";
import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { BarcodeScanner } from "./BarcodeScanner";
import type { Product } from "@shared/schema";
import { useLanguage } from "@/i18n/LanguageContext";

export default function FloatingScannerButton() {
  const { t, dir, isRtl } = useLanguage();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [position, setPosition] = useState({ x: 24, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const playErrorSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 200;
      oscillator.type = "square";
      gainNode.gain.value = 0.1;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 200);
    } catch (e) {}
  }, []);

  const playSuccessSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.value = 0.1;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 150);
    } catch (e) {}
  }, []);

  const handleBarcodeScan = useCallback(async (code: string) => {
    try {
      const response = await fetch(`/api/products/by-suffix/${code}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const foundProducts: Product[] = await response.json();
      
      if (foundProducts.length === 0) {
        playErrorSound();
        if (navigator.vibrate) navigator.vibrate(200);
        toast({
          variant: "destructive",
          title: t.pos.productNotFound,
          description: `${t.pos.productNotFoundWithCode} ${code}`,
        });
        setTimeout(() => {
          setIsScannerOpen(false);
          setLocation(`/products?newSku=${code}`);
        }, 1500);
        return;
      }
      
      const product = foundProducts[0];
      playSuccessSound();
      if (navigator.vibrate) navigator.vibrate(50);
      
      localStorage.setItem("pendingAddToCart", product.id.toString());
      setIsScannerOpen(false);
      setLocation("/pos");
      
      toast({
        title: `✓ ${t.scanner.productAddedToCart}`,
        description: `${product.name} - ${Number(product.salePrice).toLocaleString()} ${t.common.currency}`,
      });
      
    } catch (error) {
      console.error("Error finding product:", error);
      playErrorSound();
      toast({
        variant: "destructive",
        title: t.common.error,
        description: t.pos.errorSearchingProduct,
      });
    }
  }, [playErrorSound, playSuccessSound, setLocation, toast, t]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  }, [position]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startX: position.x,
      startY: position.y,
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      const newX = Math.max(0, Math.min(window.innerWidth - 56, dragStartRef.current.startX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 56, dragStartRef.current.startY + deltaY));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;
      const newX = Math.max(0, Math.min(window.innerWidth - 56, dragStartRef.current.startX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 56, dragStartRef.current.startY + deltaY));
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  const handleClick = useCallback(() => {
    if (!isDragging) {
      setIsScannerOpen(true);
    }
  }, [isDragging]);

  return (
    <>
      <Button
        ref={dragRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        className="fixed z-50 h-16 w-16 rounded-2xl shadow-2xl from-primary via-primary to-primary/80 hover:from-primary/90 hover:to-primary cursor-grab active:cursor-grabbing touch-none select-none ring-4 ring-primary/30 hover:ring-primary/50 bg-[#914021]"
        style={{ 
          left: position.x, 
          top: position.y,
          transition: isDragging ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out',
          boxShadow: '0 8px 32px rgba(var(--primary), 0.4), 0 0 20px rgba(var(--primary), 0.3)'
        }}
        size="icon"
        data-testid="button-floating-scanner"
      >
        <ScanBarcode className="h-7 w-7" />
      </Button>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
        title={t.scanner.title}
        continuous={true}
      />
    </>
  );
}
