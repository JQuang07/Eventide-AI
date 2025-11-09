import jsQR from 'jsqr';
import { createCanvas, loadImage } from 'canvas';
import { readFile } from 'fs/promises';
import { Buffer } from 'buffer';

/**
 * Service for extracting QR codes from images with multiple preprocessing strategies
 */
export class QRCodeExtractor {
  /**
   * Extract QR code URL from a base64 image using multiple strategies
   * @param imageBase64 Base64 encoded image (with or without data URI prefix)
   * @returns URL from QR code if found, null otherwise
   */
  async extractFromBase64(imageBase64: string): Promise<string | null> {
    try {
      console.log('[QRCodeExtractor] Starting QR code extraction from base64 image...');
      
      // Remove data URI prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      
      if (!base64Data || base64Data.length === 0) {
        console.warn('[QRCodeExtractor] Empty base64 data');
        return null;
      }
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      console.log(`[QRCodeExtractor] Image buffer size: ${imageBuffer.length} bytes`);
      
      // Load image
      const image = await loadImage(imageBuffer);
      console.log(`[QRCodeExtractor] Image loaded: ${image.width}x${image.height}`);
      
      // Try multiple extraction strategies
      const strategies = [
        () => this.tryExtractOriginal(image),
        () => this.tryExtractResized(image, 1000), // Resize to 1000px max dimension
        () => this.tryExtractResized(image, 2000), // Try larger size
        () => this.tryExtractGrayscale(image), // Convert to grayscale
        () => this.tryExtractHighContrast(image), // Enhance contrast
        () => this.tryExtractFromRegions(image), // Try different regions (corners, center)
      ];
      
      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`[QRCodeExtractor] Trying strategy ${i + 1}/${strategies.length}...`);
          const result = await strategies[i]();
          if (result) {
            console.log(`[QRCodeExtractor] ✓ Found QR code using strategy ${i + 1}: ${result}`);
            return result;
          }
        } catch (error: any) {
          console.warn(`[QRCodeExtractor] Strategy ${i + 1} failed:`, error.message);
        }
      }
      
      console.log('[QRCodeExtractor] No QR code found after trying all strategies');
      return null;
    } catch (error: any) {
      console.error(`[QRCodeExtractor] Error extracting QR code:`, error.message);
      console.error(`[QRCodeExtractor] Error stack:`, error.stack);
      return null;
    }
  }

  /**
   * Try extracting QR code from original image
   */
  private tryExtractOriginal(image: any): string | null {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    return this.decodeQRCode(imageData);
  }

  /**
   * Try extracting QR code from resized image
   */
  private tryExtractResized(image: any, maxDimension: number): string | null {
    let width = image.width;
    let height = image.height;
    
    // Calculate new dimensions maintaining aspect ratio
    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height / width) * maxDimension);
        width = maxDimension;
      }
    } else {
      if (height > maxDimension) {
        width = Math.round((width / height) * maxDimension);
        height = maxDimension;
      }
    }
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    return this.decodeQRCode(imageData);
  }

  /**
   * Try extracting QR code from grayscale image
   */
  private tryExtractGrayscale(image: any): string | null {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const data = imageData.data;
    
    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      // Alpha stays the same
    }
    
    ctx.putImageData(imageData, 0, 0);
    return this.decodeQRCode(imageData);
  }

  /**
   * Try extracting QR code from high contrast image
   */
  private tryExtractHighContrast(image: any): string | null {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const data = imageData.data;
    
    // Enhance contrast
    const factor = 1.5; // Contrast factor
    const intercept = 128 * (1 - factor);
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));     // R
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept)); // G
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept)); // B
    }
    
    ctx.putImageData(imageData, 0, 0);
    return this.decodeQRCode(imageData);
  }

  /**
   * Try extracting QR code from different regions (corners, center)
   */
  private tryExtractFromRegions(image: any): string | null {
    const regions = [
      { x: 0, y: 0, w: image.width, h: image.height }, // Full image
      { x: 0, y: 0, w: Math.floor(image.width * 0.5), h: Math.floor(image.height * 0.5) }, // Top-left
      { x: Math.floor(image.width * 0.5), y: 0, w: Math.floor(image.width * 0.5), h: Math.floor(image.height * 0.5) }, // Top-right
      { x: 0, y: Math.floor(image.height * 0.5), w: Math.floor(image.width * 0.5), h: Math.floor(image.height * 0.5) }, // Bottom-left
      { x: Math.floor(image.width * 0.5), y: Math.floor(image.height * 0.5), w: Math.floor(image.width * 0.5), h: Math.floor(image.height * 0.5) }, // Bottom-right
      { x: Math.floor(image.width * 0.25), y: Math.floor(image.height * 0.25), w: Math.floor(image.width * 0.5), h: Math.floor(image.height * 0.5) }, // Center
    ];
    
    for (const region of regions) {
      const canvas = createCanvas(region.w, region.h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
      const imageData = ctx.getImageData(0, 0, region.w, region.h);
      const result = this.decodeQRCode(imageData);
      if (result) return result;
    }
    
    return null;
  }

  /**
   * Decode QR code from image data
   */
  private decodeQRCode(imageData: any): string | null {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    
    if (!code || !code.data) {
      // Try with inversion
      const codeInverted = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      
      if (codeInverted && codeInverted.data) {
        const url = codeInverted.data.trim();
        if (this.isValidUrl(url)) {
          return url;
        }
      }
      return null;
    }
    
    const url = code.data.trim();
    if (this.isValidUrl(url)) {
      return url;
    }
    
    return null;
  }

  /**
   * Extract QR code URL from an image file path
   * @param imagePath Path to image file
   * @returns URL from QR code if found, null otherwise
   */
  async extractFromFile(imagePath: string): Promise<string | null> {
    try {
      const imageBuffer = await readFile(imagePath);
      const base64 = imageBuffer.toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64}`;
      return await this.extractFromBase64(dataUri);
    } catch (error: any) {
      console.warn(`[QRCodeExtractor] Error extracting QR code from file:`, error.message);
      return null;
    }
  }

  /**
   * Validate if a string is a valid URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

