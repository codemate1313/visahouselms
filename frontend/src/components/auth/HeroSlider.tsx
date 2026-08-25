import { useEffect, useState } from "react";
import { DEFAULT_LOGIN_SLIDES } from "@/api/heroSlides";
import { useHeroSlides } from "@/hooks/useHeroSlides";

export function HeroSlider() {
  const slides = useHeroSlides("login", DEFAULT_LOGIN_SLIDES);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // A shorter list arriving from the API must not leave the index out of range.
  useEffect(() => {
    setCurrentSlideIndex((prev) => (prev < slides.length ? prev : 0));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  const activeSlide = slides[currentSlideIndex] ?? slides[0];
  if (!activeSlide) return null;

  return (
    <div className="login-hero-slider" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
      {/* Image track wrapped in its own area */}
      <div className="hero-slider-image-area">
        <div className="hero-slider-track" style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}>
          {slides.map((slide) => (
            <div key={slide.id} className="hero-slide-item">
              <img src={slide.image_url} alt={slide.title} className="hero-slide-img" />
              <div className="hero-slide-overlay" />
            </div>
          ))}
        </div>

        {/* Text overlay stays on top of the image */}
        <div className="hero-slide-content" key={activeSlide.id}>
          {activeSlide.badge && <span className="hero-kicker-badge">{activeSlide.badge}</span>}
          <h2 className="hero-slide-title">{activeSlide.title}</h2>
          {activeSlide.subtitle && <p className="hero-slide-subtitle">{activeSlide.subtitle}</p>}
        </div>
        {/* Dots centered over the image, no nav arrows */}
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
