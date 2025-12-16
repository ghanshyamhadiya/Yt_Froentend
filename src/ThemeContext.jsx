import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check if theme is stored in localStorage
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const transitionRef = useRef(null);

  useEffect(() => {
    // Update localStorage when theme changes
    localStorage.setItem('theme', theme);
    
    // Update document attributes for theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const createRippleEffect = (x, y) => {
    // Create a ripple container element
    const rippleContainer = document.createElement('div');
    rippleContainer.className = 'theme-transition-container';
    rippleContainer.style.position = 'fixed';
    rippleContainer.style.top = '0';
    rippleContainer.style.left = '0';
    rippleContainer.style.width = '100vw';
    rippleContainer.style.height = '100vh';
    rippleContainer.style.pointerEvents = 'none';
    rippleContainer.style.zIndex = '5'; // Lower z-index so it doesn't hide interactive elements
    // No mix-blend-mode as it can cause visibility issues
    
    // Create the actual ripple element
    const ripple = document.createElement('div');
    ripple.className = 'theme-transition-ripple';
    ripple.style.position = 'absolute';
    ripple.style.top = '0';
    ripple.style.left = '0';
    ripple.style.width = '100%';
    ripple.style.height = '100%';
    // Use a semi-transparent color based on the theme we're transitioning to
    ripple.style.backgroundColor = theme === 'light' ? 'rgba(18, 18, 18, 0.15)' : 'rgba(247, 247, 250, 0.15)';
    ripple.style.backdropFilter = 'blur(1px)'; // Very slight blur effect that won't hide content
    
    // Create the ripple circle with clip-path
    const maxDim = Math.max(window.innerWidth, window.innerHeight) * 2;
    ripple.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    ripple.style.transition = 'clip-path 1s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Add ripple to container, then container to DOM
    rippleContainer.appendChild(ripple);
    document.body.appendChild(rippleContainer);
    
    // Force reflow
    ripple.getBoundingClientRect();
    
    // Start animation
    ripple.style.clipPath = `circle(${maxDim}px at ${x}px ${y}px)`;
    
    // Clean up after animation
    setTimeout(() => {
      document.body.removeChild(rippleContainer);
      setIsAnimating(false);
    }, 1000);
  };

  const toggleTheme = (event) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    // Get position from event or use center of screen
    const x = event?.clientX || window.innerWidth / 2;
    const y = event?.clientY || window.innerHeight / 2;
    setPosition({ x, y });
    
    // Start ripple effect
    createRippleEffect(x, y);
    
    // Change theme after a slight delay to allow animation to start
    setTimeout(() => {
      setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    }, 50);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isAnimating }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);