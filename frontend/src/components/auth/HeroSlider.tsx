import { useEffect, useState } from "react";
import { useLoginSliderStore } from "@/store/loginSliderStore";

export function HeroSlider() {
  const slides = useLoginSliderStore((state) => state.slides);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  const activeSlide = slides[currentSlideIndex] ?? slides[0];

  return (
    <div className="login-hero-slider" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
      <div className="hero-slider-track" style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}>
        {slides.map((slide) => (
          <div key={slide.id} className="hero-slide-item">
            <img src={slide.imageUrl} alt={slide.title} className="hero-slide-img" />
            <div className="hero-slide-overlay" />
          </div>
        ))}
      </div>

      <div className="hero-slide-content" key={activeSlide.id}>
        <span className="hero-kicker-badge">{activeSlide.badge}</span>
        <h2 className="hero-slide-title">{activeSlide.title}</h2>
        <p className="hero-slide-subtitle">{activeSlide.subtitle}</p>

        {slides.length > 1 && (
          <div className="hero-slider-dots">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                className={`slider-dot ${idx === currentSlideIndex ? "active" : ""}`}
                onClick={() => setCurrentSlideIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
