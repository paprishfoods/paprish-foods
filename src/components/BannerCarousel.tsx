import { useState, useEffect, useRef } from 'react';

interface BannerCarouselProps {
    images: string[];
    loading?: boolean;
}

export default function BannerCarousel({ images, loading = false }: BannerCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    // Auto-slide only if not loading and we have images
    useEffect(() => {
        if (loading || images.length <= 1 || isPaused) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [images, loading, isPaused]);

    function handleTouchStart(e: React.TouchEvent | React.MouseEvent) {
        setIsPaused(true);
        touchStartX.current = "touches" in e ? e.touches[0].clientX : e.clientX;
    }

    function handleTouchMove(e: React.TouchEvent | React.MouseEvent) {
        touchEndX.current = "touches" in e ? e.touches[0].clientX : e.clientX;
    }

    function handleTouchEnd() {
        const diff = touchStartX.current - touchEndX.current;
        const threshold = 50;
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                setCurrentIndex((prev) => (prev + 1) % images.length);
            } else {
                setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
            }
        }
        setIsPaused(false);
    }

    const goToSlide = (index: number) => {
        setCurrentIndex(index);
    };

    // --- Render content based on state ---
    const renderContent = () => {
        if (loading) {
            // Skeleton placeholder – matches the banner dimensions
            return (
                <div className="relative w-full aspect-video rounded-2xl shadow-xl shadow-black/5 border border-paprish-200/30 overflow-hidden bg-gray-200 animate-pulse">
                    <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
                </div>
            );
        }

        if (!images || images.length === 0) {
            // No banners – show a subtle placeholder (still occupies space)
            return (
                <div className="relative w-full aspect-video rounded-2xl shadow-xl shadow-black/5 border border-paprish-200/30 overflow-hidden bg-cream-100 flex items-center justify-center">
                    <span className="text-paprish-400/50 font-serif text-sm">No banners available</span>
                </div>
            );
        }

        // Actual carousel
        return (
            <div
                className="relative w-full aspect-video rounded-2xl shadow-xl shadow-black/5 border border-paprish-200/30 overflow-hidden group select-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onMouseLeave={() => setIsPaused(false)}
            >
                <div
                    className="flex h-full w-full transition-transform duration-700 ease-in-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {images.map((src, index) => (
                        <div key={index} className="flex-[0_0_100%] min-w-0 h-full">
                            <img
                                src={src}
                                alt={`Banner ${index + 1}`}
                                className="w-full h-full object-cover"
                                loading={index === 0 ? "eager" : "lazy"}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"%3E%3Crect fill="%23fdf6ec" width="800" height="450"/%3E%3Ctext fill="%23c4853d" font-family="serif" font-size="30" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Navigation dots – only show if more than 1 image */}
                {images.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 pointer-events-none">
                        <div className="flex gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full pointer-events-auto">
                            {images.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => goToSlide(index)}
                                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentIndex
                                            ? 'bg-paprish-400 w-6'
                                            : 'bg-white/60 hover:bg-white/90'
                                        }`}
                                    aria-label={`Go to slide ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Birthday offer button – appears on hover, doesn't block swipes */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center bg-black/20 pointer-events-none">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent("open-birthday-offer"))}
                        className="pointer-events-auto flex items-center gap-2 bg-gradient-to-r from-amber-400 to-pink-500 text-white text-lg font-bold px-8 py-4 rounded-full shadow-xl shadow-pink-500/30 hover:scale-105 transition-transform"
                    >
                        🎂 Claim Your Birthday Offer
                    </button>
                </div>
            </div>
        );
    };

    // --- Outer container – always rendered with same padding ---
    return (
        <div className="w-full bg-cream-50 pt-40 sm:pt-48 md:pt-56 lg:pt-64 -mb-16 sm:mb-0 relative overflow-hidden">
            {/* Dotted pattern */}
            <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                    backgroundImage: `radial-gradient(circle, #c4853d 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}
            />
            {/* Warm glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-paprish-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {renderContent()}
            </div>
        </div>
    );
}