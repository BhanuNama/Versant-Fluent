import type { Transition, Variants } from 'framer-motion';

export const DURATION = {
  hover: 0.12,
  state: 0.2,
  transition: 0.32,
  scoreReveal: 0.8,
} as const;

export const EASING = {
  enter: [0.2, 0, 0, 1] as [number, number, number, number],
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
};

export const standardTransition: Transition = {
  duration: DURATION.transition,
  ease: EASING.enter,
};

export const fadeSlideVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: standardTransition },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.state, ease: EASING.exit } },
};

export const cardHoverVariants: Variants = {
  initial: { y: 0 },
  hover: { y: -2, transition: { duration: DURATION.hover } },
};

export const buttonTapTransition: Transition = {
  duration: DURATION.hover,
  ease: 'easeInOut',
};
