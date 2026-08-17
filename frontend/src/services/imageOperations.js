/**
 * Image Operations Service
 * Handles image wrapping, rotation, layering, sizing
 */

export class ImageOperationsService {
  /**
   * Set image text wrapping
   */
  static setImageWrapping(imageElement, wrapping = 'inline') {
    if (!imageElement) return false;

    try {
      // Remove previous wrapping classes
      ['etherx-wrap-inline', 'etherx-wrap-square', 'etherx-wrap-tight', 'etherx-wrap-through', 'etherx-wrap-behind', 'etherx-wrap-front'].forEach((cls) => {
        imageElement.classList.remove(cls);
      });

      switch (wrapping) {
        case 'square':
          imageElement.classList.add('etherx-wrap-square');
          imageElement.style.float = 'left';
          imageElement.style.margin = '8px 8px 8px 0';
          break;
        case 'tight':
          imageElement.classList.add('etherx-wrap-tight');
          imageElement.style.float = 'left';
          imageElement.style.margin = '8px 8px 8px 0';
          break;
        case 'through':
          imageElement.classList.add('etherx-wrap-through');
          imageElement.style.position = 'absolute';
          break;
        case 'behind':
          imageElement.classList.add('etherx-wrap-behind');
          imageElement.style.position = 'absolute';
          imageElement.style.zIndex = '-1';
          break;
        case 'front':
          imageElement.classList.add('etherx-wrap-front');
          imageElement.style.position = 'absolute';
          imageElement.style.zIndex = '1000';
          break;
        default: // inline
          imageElement.classList.add('etherx-wrap-inline');
          imageElement.style.float = 'none';
          imageElement.style.position = 'static';
          break;
      }

      return true;
    } catch (err) {
      console.error('Set image wrapping failed:', err);
      return false;
    }
  }

  /**
   * Rotate image
   */
  static rotateImage(imageElement, degrees = 0) {
    if (!imageElement) return false;

    try {
      // Normalize degrees to 0-360
      const normalizedDegrees = ((degrees % 360) + 360) % 360;
      
      imageElement.style.transform = `rotate(${normalizedDegrees}deg)`;
      imageElement.setAttribute('data-rotation', normalizedDegrees);
      
      return true;
    } catch (err) {
      console.error('Rotate image failed:', err);
      return false;
    }
  }

  /**
   * Flip image horizontally or vertically
   */
  static flipImage(imageElement, direction = 'horizontal') {
    if (!imageElement) return false;

    try {
      const currentTransform = imageElement.style.transform || '';
      let transform = currentTransform;

      if (direction === 'horizontal') {
        transform = transform.includes('scaleX(-1)')
          ? transform.replace(/scaleX\(-1\)/, '')
          : (transform + ' scaleX(-1)').trim();
      } else if (direction === 'vertical') {
        transform = transform.includes('scaleY(-1)')
          ? transform.replace(/scaleY\(-1\)/, '')
          : (transform + ' scaleY(-1)').trim();
      }

      imageElement.style.transform = transform;
      return true;
    } catch (err) {
      console.error('Flip image failed:', err);
      return false;
    }
  }

  /**
   * Set image z-index for layering
   */
  static setImageLayer(imageElement, position = 'middle') {
    if (!imageElement) return false;

    try {
      switch (position) {
        case 'front':
          imageElement.style.zIndex = '1000';
          imageElement.setAttribute('data-layer', 'front');
          break;
        case 'back':
          imageElement.style.zIndex = '-1';
          imageElement.setAttribute('data-layer', 'back');
          break;
        case 'forward':
          const currentZ = parseInt(imageElement.style.zIndex || '0', 10);
          imageElement.style.zIndex = String(currentZ + 1);
          imageElement.setAttribute('data-layer', 'forward');
          break;
        case 'backward':
          const currentZ2 = parseInt(imageElement.style.zIndex || '0', 10);
          imageElement.style.zIndex = String(Math.max(-1, currentZ2 - 1));
          imageElement.setAttribute('data-layer', 'backward');
          break;
        default: // middle
          imageElement.style.zIndex = '0';
          imageElement.setAttribute('data-layer', 'middle');
      }

      return true;
    } catch (err) {
      console.error('Set image layer failed:', err);
      return false;
    }
  }

  /**
   * Resize image
   */
  static resizeImage(imageElement, width, height, maintainAspectRatio = true) {
    if (!imageElement) return false;

    try {
      if (maintainAspectRatio && width && imageElement.naturalHeight && imageElement.naturalWidth) {
        const ratio = imageElement.naturalHeight / imageElement.naturalWidth;
        height = width * ratio;
      }

      if (width) imageElement.style.width = `${width}px`;
      if (height) imageElement.style.height = `${height}px`;

      imageElement.setAttribute('data-width', width);
      imageElement.setAttribute('data-height', height);

      return true;
    } catch (err) {
      console.error('Resize image failed:', err);
      return false;
    }
  }

  /**
   * Add border/frame to image
   */
  static addImageBorder(imageElement, width = 2, color = '#000000', style = 'solid') {
    if (!imageElement) return false;

    try {
      imageElement.style.border = `${width}px ${style} ${color}`;
      imageElement.style.boxSizing = 'border-box';
      imageElement.setAttribute('data-border-width', width);
      imageElement.setAttribute('data-border-color', color);
      imageElement.setAttribute('data-border-style', style);

      return true;
    } catch (err) {
      console.error('Add image border failed:', err);
      return false;
    }
  }

  /**
   * Add shadow effect to image
   */
  static addImageShadow(imageElement, blur = 8, spread = 0, offsetX = 0, offsetY = 4, color = 'rgba(0,0,0,0.3)') {
    if (!imageElement) return false;

    try {
      imageElement.style.boxShadow = `${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
      imageElement.setAttribute('data-shadow', 'true');

      return true;
    } catch (err) {
      console.error('Add image shadow failed:', err);
      return false;
    }
  }

  /**
   * Apply brightness/contrast filters
   */
  static applyImageFilters(imageElement, brightness = 100, contrast = 100, saturation = 100) {
    if (!imageElement) return false;

    try {
      imageElement.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      imageElement.setAttribute('data-brightness', brightness);
      imageElement.setAttribute('data-contrast', contrast);
      imageElement.setAttribute('data-saturation', saturation);

      return true;
    } catch (err) {
      console.error('Apply image filters failed:', err);
      return false;
    }
  }

  /**
   * Get image properties
   */
  static getImageProperties(imageElement) {
    if (!imageElement) return null;

    try {
      return {
        src: imageElement.src,
        width: imageElement.offsetWidth,
        height: imageElement.offsetHeight,
        naturalWidth: imageElement.naturalWidth,
        naturalHeight: imageElement.naturalHeight,
        wrapping: imageElement.getAttribute('data-wrapping') || 'inline',
        rotation: parseInt(imageElement.getAttribute('data-rotation') || '0', 10),
        zIndex: imageElement.style.zIndex || '0',
        border: imageElement.style.border || 'none',
        shadow: imageElement.hasAttribute('data-shadow'),
        brightness: parseInt(imageElement.getAttribute('data-brightness') || '100', 10),
        contrast: parseInt(imageElement.getAttribute('data-contrast') || '100', 10),
        saturation: parseInt(imageElement.getAttribute('data-saturation') || '100', 10),
      };
    } catch (err) {
      console.error('Get image properties failed:', err);
      return null;
    }
  }
}

export default ImageOperationsService;
