import React, { useState, useEffect } from 'react';
import { ButtonScrollToTopStyle } from '../style/ButtonScrollToTop';

const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = () => {
    if (window.scrollY > 20) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <ButtonScrollToTopStyle id="scrollToTopBtn" isvisible={isVisible.toString()} onClick={scrollToTop}>
    &#9650;
  </ButtonScrollToTopStyle>
  );
}

export default ScrollToTopButton;
