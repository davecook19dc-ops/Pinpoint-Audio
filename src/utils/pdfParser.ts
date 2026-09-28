import * as pdfjsLib from 'pdfjs-dist';

// Configure worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface ExtractedSlide {
  blob: Blob;
  name: string;
}

export async function parsePdfSlides(file: File): Promise<ExtractedSlide[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const slides: ExtractedSlide[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High-res rendering
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');

    if (!context) continue;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => {
        resolve(b || new Blob());
      }, 'image/png', 0.95);
    });

    slides.push({
      blob,
      name: `${file.name.replace(/\.[^/.]+$/, '')}_Page_${i}.png`,
    });
  }

  return slides;
}
