import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { ButtonScrollToTopStyle } from '../style/ButtonScrollToTop';

const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = () => {
    if (window.scrollY > 220) {
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
    <ButtonScrollToTopStyle
      id="scrollToTopBtn"
      isVisible={isVisible}
      onClick={scrollToTop}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
    >
      <ChevronUp className="h-5 w-5" />
    </ButtonScrollToTopStyle>
  );
}

export default ScrollToTopButton;
