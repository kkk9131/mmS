import React from 'react';
import { Image, ImageProps } from 'react-native';

interface LazyImageProps extends ImageProps {
  src?: string;
  alt?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, source, ...props }) => {
  const imageSource = src ? { uri: src } : source;
  
  return (
    <Image
      source={imageSource}
      accessibilityLabel={alt}
      {...props}
    />
  );
};

export default LazyImage;