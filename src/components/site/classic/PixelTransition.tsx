import {
  useRef,
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { gsap } from "gsap";

import "./PixelTransition.css";

interface PixelTransitionProps {
  firstContent: ReactNode;
  secondContent: ReactNode;
  gridSize?: number;
  /**
   * Colour of the tile wipe. Defaults to the theme accent via a CSS variable so
   * it follows the active preset — the caller does not pass a hex.
   */
  pixelColor?: string;
  animationStepDuration?: number;
  once?: boolean;
  /** How the card opens: on pointer hover (desktop default) or on click/tap. */
  trigger?: "hover" | "click";
  aspectRatio?: string;
  className?: string;
  style?: CSSProperties;
}

export default function PixelTransition({
  firstContent,
  secondContent,
  gridSize = 7,
  pixelColor = "var(--theme-gold)",
  animationStepDuration = 0.3,
  once = false,
  trigger = "hover",
  aspectRatio = "100%",
  className = "",
  style = {},
}: PixelTransitionProps) {
  const pixelGridRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const delayedCallRef = useRef<gsap.core.Tween | null>(null);

  const [isActive, setIsActive] = useState(false);

  const isTouchDevice =
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches);

  useEffect(() => {
    const pixelGridEl = pixelGridRef.current;
    if (!pixelGridEl) return;

    pixelGridEl.innerHTML = "";

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const pixel = document.createElement("div");
        pixel.classList.add("pixelated-image-card__pixel");
        pixel.style.backgroundColor = pixelColor;

        const size = 100 / gridSize;
        pixel.style.width = `${size}%`;
        pixel.style.height = `${size}%`;
        pixel.style.left = `${col * size}%`;
        pixel.style.top = `${row * size}%`;
        pixelGridEl.appendChild(pixel);
      }
    }
  }, [gridSize, pixelColor]);

  const animatePixels = (activate: boolean) => {
    setIsActive(activate);

    const pixelGridEl = pixelGridRef.current;
    const activeEl = activeRef.current;
    if (!pixelGridEl || !activeEl) return;

    const pixels = pixelGridEl.querySelectorAll<HTMLElement>(".pixelated-image-card__pixel");
    if (!pixels.length) return;

    gsap.killTweensOf(pixels);
    if (delayedCallRef.current) delayedCallRef.current.kill();

    gsap.set(pixels, { display: "none" });

    const totalPixels = pixels.length;
    const staggerDuration = animationStepDuration / totalPixels;

    gsap.to(pixels, {
      display: "block",
      duration: 0,
      stagger: { each: staggerDuration, from: "random" },
    });

    delayedCallRef.current = gsap.delayedCall(animationStepDuration, () => {
      activeEl.style.display = activate ? "block" : "none";
      activeEl.style.pointerEvents = activate ? "none" : "";
    });

    gsap.to(pixels, {
      display: "none",
      duration: 0,
      delay: animationStepDuration,
      stagger: { each: staggerDuration, from: "random" },
    });
  };

  const handleEnter = () => {
    if (!isActive) animatePixels(true);
  };
  const handleLeave = () => {
    if (isActive && !once) animatePixels(false);
  };
  const handleClick = () => {
    if (!isActive) animatePixels(true);
    else if (isActive && !once) animatePixels(false);
  };
  // In click mode a div still needs explicit key handling to be operable by keyboard
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (trigger === "click" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      handleClick();
    }
  };

  const clickOnly = trigger === "click";

  return (
    <div
      className={`pixelated-image-card ${className}`}
      style={style}
      onMouseEnter={!isTouchDevice && !clickOnly ? handleEnter : undefined}
      onMouseLeave={!isTouchDevice && !clickOnly ? handleLeave : undefined}
      onClick={clickOnly || isTouchDevice ? handleClick : undefined}
      onFocus={!isTouchDevice && !clickOnly ? handleEnter : undefined}
      onBlur={!isTouchDevice && !clickOnly ? handleLeave : undefined}
      onKeyDown={clickOnly ? handleKeyDown : undefined}
      role={clickOnly ? "button" : undefined}
      aria-expanded={clickOnly ? isActive : undefined}
      tabIndex={0}
    >
      <div style={{ paddingTop: aspectRatio }} />
      <div className="pixelated-image-card__default" aria-hidden={isActive}>
        {firstContent}
      </div>
      <div className="pixelated-image-card__active" ref={activeRef} aria-hidden={!isActive}>
        {secondContent}
      </div>
      <div className="pixelated-image-card__pixels" ref={pixelGridRef} />
    </div>
  );
}