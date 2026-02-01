/**
 * Compresses an image file to a target size (approx) using HTML5 Canvas.
 * Simulates WhatsApp-style compression.
 * 
 * @param file - The source File object
 * @param maxWidth - Maximum width (default 1600px)
 * @param quality - JPEG quality (0.0 to 1.0, default 0.7)
 * @returns Promise resolving to a compressed base64 string (without prefix)
 */
export const compressImage = (file: File, maxWidth = 1600, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if larger than max width/height
        if (width > maxWidth || height > maxWidth) { // Check both dimensions
          if (width > height) {
            height *= maxWidth / width;
            width = maxWidth;
          } else {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with quality compression
        // 'image/jpeg' is good for photos and supports quality parameter
        const dataUrl = elem.toDataURL('image/jpeg', quality);

        // Remove prefix to get raw base64
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
