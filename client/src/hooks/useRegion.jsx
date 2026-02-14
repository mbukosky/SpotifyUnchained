import { useState, createContext, useContext } from 'react';

const RegionContext = createContext();

export function RegionProvider({ children }) {
  const [region, setRegion] = useState(() => {
    return localStorage.getItem('selectedRegion') || 'ALL';
  });

  const changeRegion = (r) => {
    setRegion(r);
    localStorage.setItem('selectedRegion', r);
  };

  return (
    <RegionContext.Provider value={{ region, changeRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
