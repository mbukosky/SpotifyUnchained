import { useState, createContext, useContext } from 'react';

const RegionContext = createContext();

export function RegionProvider({ children }) {
  const [savedRegion, setSavedRegion] = useState(() => {
    return localStorage.getItem('selectedRegion') || 'ALL';
  });
  // A deep link to another region's edition shows that region for the visit
  // without overwriting the visitor's saved choice. Any region click clears it.
  const [viewRegion, setViewRegion] = useState(null);

  const changeRegion = (r) => {
    setViewRegion(null);
    setSavedRegion(r);
    localStorage.setItem('selectedRegion', r);
  };

  const region = viewRegion || savedRegion;

  return (
    <RegionContext.Provider value={{ region, changeRegion, showRegion: setViewRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
