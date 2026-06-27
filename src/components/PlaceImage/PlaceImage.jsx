import React, { useEffect, useState } from 'react';
import { getPlaceImage } from '../../utils/images';

// Loads a real photo for a place (Wikipedia) with a skeleton while fetching.
const PlaceImage = ({ query, seed, alt, className, style }) => {
    const [src, setSrc] = useState(null);

    useEffect(() => {
        let active = true;
        setSrc(null);
        getPlaceImage(query, seed).then(u => { if (active) setSrc(u); });
        return () => { active = false; };
    }, [query, seed]);

    if (!src) return <div className={`skeleton ${className || ''}`} style={style} />;
    return <img src={src} alt={alt || query} className={className} style={{ ...style, objectFit: 'cover' }} loading="lazy" />;
};

export default PlaceImage;
