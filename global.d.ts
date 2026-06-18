declare module "*.css";
// src/types/swiper.d.ts
declare module "swiper/css";
declare module "swiper/css/navigation";
declare module "swiper/css/pagination";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}
