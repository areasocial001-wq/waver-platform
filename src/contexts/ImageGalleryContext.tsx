import { createContext, useContext, useState, ReactNode } from "react";

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  aspectRatio: string;
  model: string;
}

interface ImageGalleryContextType {
  images: GeneratedImage[];
  addImage: (image: Omit<GeneratedImage, "id" | "timestamp">) => void;
  removeImage: (id: string) => void;
  clearGallery: () => void;
}

const ImageGalleryContext = createContext<ImageGalleryContextType | undefined>(undefined);

export const ImageGalleryProvider = ({ children }: { children: ReactNode }) => {
  const [images, setImages] = useState<GeneratedImage[]>([]);

  const addImage = (image: Omit<GeneratedImage, "id" | "timestamp">) => {
    const newImage: GeneratedImage = {
      ...image,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setImages((prev) => [newImage, ...prev]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const clearGallery = () => {
    setImages([]);
  };

  return (
    <ImageGalleryContext.Provider value={{ images, addImage, removeImage, clearGallery }}>
      {children}
    </ImageGalleryContext.Provider>
  );
};

export const useImageGallery = () => {
  const context = useContext(ImageGalleryContext);
  if (context === undefined) {
    throw new Error("useImageGallery must be used within an ImageGalleryProvider");
  }
  return context;
};